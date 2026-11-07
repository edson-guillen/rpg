-- Contas, personagens, campanhas, anotações e sugestões.
-- Regra geral: o navegador só lê o que a RLS permite; o que muda dados sensíveis passa por funções.

create extension if not exists pgcrypto with schema extensions;

/* ---------- tabelas ---------- */
create table public.perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  criado_em timestamptz not null default now()
);

-- Preferências, magias próprias e notas gerais: só o dono lê.
create table public.contas (
  user_id uuid primary key references auth.users on delete cascade,
  dados jsonb not null default '{}',
  atualizado_em timestamptz not null default now()
);

-- A ficha completa fica aqui e nunca é legível por outra pessoa.
create table public.personagens (
  dono uuid not null references auth.users on delete cascade,
  id text not null check (char_length(id) between 1 and 40),
  nome text not null check (char_length(nome) between 1 and 60),
  dados jsonb not null,
  versao integer not null default 1,
  atualizado_em timestamptz not null default now(),
  primary key (dono, id)
);

create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 80),
  descricao text not null default '' check (char_length(descricao) <= 1000),
  mestre uuid not null references auth.users on delete cascade,
  codigo text not null unique,
  tem_senha boolean not null default false,
  criada_em timestamptz not null default now()
);

-- Sem nenhuma policy: só as funções abaixo enxergam o hash.
create table public.campanha_segredos (
  campanha_id uuid primary key references public.campanhas on delete cascade,
  senha_hash text
);

create table public.participantes (
  campanha_id uuid not null references public.campanhas on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  papel text not null default 'jogador' check (papel in ('mestre', 'jogador')),
  entrou_em timestamptz not null default now(),
  primary key (campanha_id, user_id)
);

-- O que a mesa vê de um personagem: nome e situação. A ficha não sai de `personagens`.
create table public.elenco (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas on delete cascade,
  jogador uuid not null references auth.users on delete cascade,
  personagem_id text,
  nome text not null,
  situacao text not null default 'ativo' check (situacao in ('ativo', 'morto', 'saiu')),
  causa text not null default '' check (char_length(causa) <= 300),
  entrou_em timestamptz not null default now(),
  encerrado_em timestamptz,
  foreign key (jogador, personagem_id) references public.personagens (dono, id) on delete set null (personagem_id)
);
create unique index elenco_um_ativo_por_jogador on public.elenco (campanha_id, jogador) where situacao = 'ativo';
create unique index elenco_personagem_uma_mesa on public.elenco (jogador, personagem_id) where situacao = 'ativo';

create table public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas on delete cascade,
  autor uuid not null references auth.users on delete cascade,
  alvo uuid references public.elenco on delete cascade,
  titulo text not null default '' check (char_length(titulo) <= 120),
  texto text not null default '' check (char_length(texto) <= 20000),
  compartilhada boolean not null default false,
  atualizado_em timestamptz not null default now()
);
create unique index anotacoes_uma_por_alvo on public.anotacoes (autor, alvo) where alvo is not null;

create table public.tentativas_entrada (
  user_id uuid not null references auth.users on delete cascade,
  em timestamptz not null default now()
);
create index tentativas_por_usuario on public.tentativas_entrada (user_id, em);

create table public.desenvolvedores (email text primary key);

create table public.sugestoes (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references auth.users on delete cascade,
  autor_nome text not null,
  tipo text not null default 'ideia' check (tipo in ('ideia', 'erro', 'regra')),
  texto text not null check (char_length(texto) between 3 and 2000),
  situacao text not null default 'nova' check (situacao in ('nova', 'lida', 'feita', 'recusada')),
  resposta text not null default '' check (char_length(resposta) <= 1000),
  criada_em timestamptz not null default now()
);

/* ---------- auxiliares ---------- */
create function public.eh_membro(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.participantes p where p.campanha_id = c and p.user_id = auth.uid())
$$;

create function public.eh_mestre(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campanhas x where x.id = c and x.mestre = auth.uid())
$$;

create function public.mesma_mesa(outro uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participantes a join public.participantes b using (campanha_id)
    where a.user_id = auth.uid() and b.user_id = outro
  )
$$;

create function public.sou_dev() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.desenvolvedores d where lower(d.email) = lower(auth.jwt() ->> 'email'))
$$;

create function public.novo_codigo_campanha() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea; r text; i int;
begin
  loop
    bytes := extensions.gen_random_bytes(10);
    r := '';
    for i in 0..9 loop r := r || substr(alfabeto, (get_byte(bytes, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.campanhas c where c.codigo = r);
  end loop;
  return r;
end $$;

-- Toda conta nova ganha um perfil só com o nome; o e-mail não é copiado para tabelas públicas.
create function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome) values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Aventureiro'), 60)
  );
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.criar_perfil();

/* ---------- personagens ---------- */
create function public.salvar_personagem(p_id text, p_nome text, p_dados jsonb, p_versao integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := auth.uid();
  atual public.personagens;
  v integer;
begin
  if eu is null then raise exception 'sem_login'; end if;
  if octet_length(p_dados::text) > 2000000 then return jsonb_build_object('ok', false, 'erro', 'grande'); end if;
  select * into atual from public.personagens where dono = eu and id = p_id for update;
  if not found then
    if (select count(*) from public.personagens where dono = eu) >= 60 then return jsonb_build_object('ok', false, 'erro', 'limite'); end if;
    insert into public.personagens (dono, id, nome, dados) values (eu, p_id, left(p_nome, 60), p_dados);
    return jsonb_build_object('ok', true, 'versao', 1);
  end if;
  if p_versao is distinct from atual.versao then
    return jsonb_build_object('ok', false, 'erro', 'conflito', 'versao', atual.versao, 'nome', atual.nome, 'dados', atual.dados);
  end if;
  update public.personagens set nome = left(p_nome, 60), dados = p_dados, versao = versao + 1, atualizado_em = now()
    where dono = eu and id = p_id returning versao into v;
  return jsonb_build_object('ok', true, 'versao', v);
end $$;

-- Mantém a mesa em dia: novo nome e morte registrados na ficha aparecem para os outros.
-- Só reage quando a marca de morte muda, para não desfazer uma morte declarada pelo mestre.
create function public.personagem_para_elenco() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  morto_antes boolean := coalesce((old.dados #>> '{state,morte,morto}')::boolean, false);
  morto_agora boolean := coalesce((new.dados #>> '{state,morte,morto}')::boolean, false);
  v_causa text := left(coalesce(new.dados #>> '{state,morte,causa}', ''), 300);
begin
  update public.elenco e set nome = new.nome where e.jogador = new.dono and e.personagem_id = new.id and e.nome <> new.nome;
  if morto_agora and not morto_antes then
    update public.elenco e set situacao = 'morto', causa = v_causa, encerrado_em = now()
      where e.jogador = new.dono and e.personagem_id = new.id and e.situacao = 'ativo';
  elsif morto_antes and not morto_agora then
    -- Reviveu: só volta à mesa se o jogador ainda não entrou com outro personagem.
    update public.elenco e set situacao = 'ativo', causa = '', encerrado_em = null
      where e.jogador = new.dono and e.personagem_id = new.id and e.situacao = 'morto'
        and not exists (select 1 from public.elenco o where o.campanha_id = e.campanha_id and o.jogador = e.jogador and o.situacao = 'ativo');
  elsif morto_agora then
    update public.elenco e set causa = v_causa
      where e.jogador = new.dono and e.personagem_id = new.id and e.situacao = 'morto' and v_causa <> '' and e.causa <> v_causa;
  end if;
  return new;
end $$;
create trigger personagem_atualizado after update on public.personagens for each row execute function public.personagem_para_elenco();

create function public.personagem_apagado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.elenco e set situacao = 'saiu', encerrado_em = now()
    where e.jogador = old.dono and e.personagem_id = old.id and e.situacao = 'ativo';
  return old;
end $$;
create trigger antes_de_apagar_personagem before delete on public.personagens for each row execute function public.personagem_apagado();

/* ---------- campanhas ---------- */
create function public.criar_campanha(p_nome text, p_descricao text, p_senha text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := auth.uid();
  novo uuid;
begin
  if eu is null then raise exception 'sem_login'; end if;
  if char_length(btrim(coalesce(p_nome, ''))) = 0 then raise exception 'sem_nome'; end if;
  if p_senha is not null and char_length(p_senha) not between 4 and 72 then raise exception 'senha_invalida'; end if;
  if (select count(*) from public.campanhas where mestre = eu) >= 30 then raise exception 'limite'; end if;
  insert into public.campanhas (nome, descricao, mestre, codigo, tem_senha)
    values (btrim(p_nome), coalesce(p_descricao, ''), eu, public.novo_codigo_campanha(), p_senha is not null)
    returning id into novo;
  insert into public.campanha_segredos (campanha_id, senha_hash)
    values (novo, case when p_senha is null then null else extensions.crypt(p_senha, extensions.gen_salt('bf', 10)) end);
  insert into public.participantes (campanha_id, user_id, papel) values (novo, eu, 'mestre');
  return novo;
end $$;

create function public.editar_campanha(p_id uuid, p_nome text, p_descricao text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_mestre(p_id) then raise exception 'so_mestre'; end if;
  update public.campanhas set nome = btrim(p_nome), descricao = coalesce(p_descricao, '') where id = p_id;
end $$;

-- p_senha nulo tira a senha: quem tiver o link entra direto.
create function public.definir_senha(p_id uuid, p_senha text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_mestre(p_id) then raise exception 'so_mestre'; end if;
  if p_senha is not null and char_length(p_senha) not between 4 and 72 then raise exception 'senha_invalida'; end if;
  update public.campanha_segredos
    set senha_hash = case when p_senha is null then null else extensions.crypt(p_senha, extensions.gen_salt('bf', 10)) end
    where campanha_id = p_id;
  update public.campanhas set tem_senha = p_senha is not null where id = p_id;
end $$;

create function public.trocar_codigo(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  if not public.eh_mestre(p_id) then raise exception 'so_mestre'; end if;
  update public.campanhas set codigo = public.novo_codigo_campanha() where id = p_id returning codigo into r;
  return r;
end $$;

-- Mostra o mínimo antes de entrar. Exige o código completo, então não permite listar campanhas.
create function public.previa_campanha(p_codigo text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nome', c.nome, 'tem_senha', c.tem_senha, 'mestre', p.nome,
           'ja_participo', public.eh_membro(c.id), 'id', case when public.eh_membro(c.id) then c.id end)
  from public.campanhas c join public.perfis p on p.id = c.mestre
  where auth.uid() is not null and c.codigo = upper(regexp_replace(p_codigo, '[^a-zA-Z0-9]', '', 'g'))
$$;

-- Retorna status em vez de lançar erro: um erro desfaria o registro da tentativa falha.
create function public.entrar_campanha(p_codigo text, p_senha text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := auth.uid();
  c public.campanhas;
  h text;
begin
  if eu is null then return jsonb_build_object('ok', false, 'erro', 'sem_login'); end if;
  if (select count(*) from public.tentativas_entrada t where t.user_id = eu and t.em > now() - interval '15 minutes') >= 8 then
    return jsonb_build_object('ok', false, 'erro', 'muitas_tentativas');
  end if;
  select * into c from public.campanhas x where x.codigo = upper(regexp_replace(p_codigo, '[^a-zA-Z0-9]', '', 'g'));
  if not found then
    insert into public.tentativas_entrada (user_id) values (eu);
    return jsonb_build_object('ok', false, 'erro', 'codigo');
  end if;
  if public.eh_membro(c.id) then return jsonb_build_object('ok', true, 'id', c.id); end if;
  select s.senha_hash into h from public.campanha_segredos s where s.campanha_id = c.id;
  if h is not null and (p_senha is null or extensions.crypt(p_senha, h) <> h) then
    insert into public.tentativas_entrada (user_id) values (eu);
    return jsonb_build_object('ok', false, 'erro', 'senha');
  end if;
  if (select count(*) from public.participantes p where p.campanha_id = c.id) >= 30 then
    return jsonb_build_object('ok', false, 'erro', 'cheia');
  end if;
  insert into public.participantes (campanha_id, user_id) values (c.id, eu);
  return jsonb_build_object('ok', true, 'id', c.id);
end $$;

create function public.adicionar_personagem(p_campanha uuid, p_personagem text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := auth.uid();
  n text;
  d jsonb;
  novo uuid;
begin
  if not public.eh_membro(p_campanha) then raise exception 'nao_participa'; end if;
  if public.eh_mestre(p_campanha) then raise exception 'mestre_sem_personagem'; end if;
  select p.nome, p.dados into n, d from public.personagens p where p.dono = eu and p.id = p_personagem;
  if not found then raise exception 'personagem_inexistente'; end if;
  if coalesce((d #>> '{state,morte,morto}')::boolean, false) then raise exception 'personagem_morto'; end if;
  if exists (select 1 from public.elenco e where e.campanha_id = p_campanha and e.jogador = eu and e.situacao = 'ativo') then raise exception 'ja_tem_ativo'; end if;
  if exists (select 1 from public.elenco e where e.jogador = eu and e.personagem_id = p_personagem and e.situacao = 'ativo') then raise exception 'em_outra_mesa'; end if;
  -- Volta quem já esteve na mesa, em vez de duplicar a linha e perder as anotações.
  update public.elenco e set situacao = 'ativo', causa = '', encerrado_em = null, nome = n
    where e.campanha_id = p_campanha and e.jogador = eu and e.personagem_id = p_personagem returning e.id into novo;
  if novo is null then
    insert into public.elenco (campanha_id, jogador, personagem_id, nome) values (p_campanha, eu, p_personagem, n) returning id into novo;
  end if;
  return novo;
end $$;

create function public.retirar_personagem(p_elenco uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.elenco;
begin
  select * into e from public.elenco x where x.id = p_elenco;
  if not found or (e.jogador <> auth.uid() and not public.eh_mestre(e.campanha_id)) then raise exception 'sem_permissao'; end if;
  update public.elenco set situacao = 'saiu', encerrado_em = now() where id = p_elenco and situacao = 'ativo';
end $$;

-- O mestre declara morte ou reverte. A ficha do jogador acompanha na próxima sincronização.
create function public.definir_situacao(p_elenco uuid, p_situacao text, p_causa text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.elenco;
begin
  select * into e from public.elenco x where x.id = p_elenco;
  if not found or (e.jogador <> auth.uid() and not public.eh_mestre(e.campanha_id)) then raise exception 'sem_permissao'; end if;
  if p_situacao not in ('ativo', 'morto') then raise exception 'situacao_invalida'; end if;
  if p_situacao = 'ativo' and exists (select 1 from public.elenco o where o.campanha_id = e.campanha_id and o.jogador = e.jogador and o.situacao = 'ativo' and o.id <> e.id) then
    raise exception 'ja_tem_ativo';
  end if;
  update public.elenco set situacao = p_situacao, causa = case when p_situacao = 'morto' then left(coalesce(p_causa, ''), 300) else '' end,
    encerrado_em = case when p_situacao = 'morto' then now() end where id = p_elenco;
end $$;

create function public.sair_campanha(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.eh_mestre(p_id) then raise exception 'mestre_nao_sai'; end if;
  update public.elenco set situacao = 'saiu', encerrado_em = now() where campanha_id = p_id and jogador = auth.uid() and situacao = 'ativo';
  delete from public.participantes where campanha_id = p_id and user_id = auth.uid();
end $$;

create function public.remover_participante(p_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_mestre(p_id) or p_user = auth.uid() then raise exception 'sem_permissao'; end if;
  update public.elenco set situacao = 'saiu', encerrado_em = now() where campanha_id = p_id and jogador = p_user and situacao = 'ativo';
  delete from public.participantes where campanha_id = p_id and user_id = p_user;
end $$;

create function public.excluir_minha_conta()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;
  delete from auth.users where id = auth.uid();
end $$;

/* ---------- sugestões ---------- */
create function public.limitar_sugestoes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.sugestoes s where s.autor = new.autor and s.criada_em > now() - interval '1 day') >= 10 then
    raise exception 'limite_sugestoes';
  end if;
  new.autor_nome := coalesce((select left(p.nome, 60) from public.perfis p where p.id = new.autor), 'Aventureiro');
  new.situacao := 'nova'; new.resposta := ''; new.criada_em := now();
  return new;
end $$;
create trigger antes_de_sugerir before insert on public.sugestoes for each row execute function public.limitar_sugestoes();

/* ---------- segurança em nível de linha ---------- */
alter table public.perfis enable row level security;
alter table public.contas enable row level security;
alter table public.personagens enable row level security;
alter table public.campanhas enable row level security;
alter table public.campanha_segredos enable row level security;
alter table public.participantes enable row level security;
alter table public.elenco enable row level security;
alter table public.anotacoes enable row level security;
alter table public.tentativas_entrada enable row level security;
alter table public.desenvolvedores enable row level security;
alter table public.sugestoes enable row level security;

create policy "ver perfil próprio ou da mesma mesa" on public.perfis for select to authenticated using (id = auth.uid() or public.mesma_mesa(id));
create policy "editar o próprio nome" on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "conta própria" on public.contas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ver as próprias fichas" on public.personagens for select to authenticated using (dono = auth.uid());
create policy "apagar as próprias fichas" on public.personagens for delete to authenticated using (dono = auth.uid());

create policy "ver campanhas onde participa" on public.campanhas for select to authenticated using (public.eh_membro(id));
create policy "mestre apaga a campanha" on public.campanhas for delete to authenticated using (mestre = auth.uid());

create policy "ver quem está na mesa" on public.participantes for select to authenticated using (public.eh_membro(campanha_id));
create policy "ver o elenco da mesa" on public.elenco for select to authenticated using (public.eh_membro(campanha_id));

create policy "ver notas próprias ou compartilhadas" on public.anotacoes for select to authenticated
  using (public.eh_membro(campanha_id) and (autor = auth.uid() or compartilhada));
create policy "criar notas próprias" on public.anotacoes for insert to authenticated
  with check (autor = auth.uid() and public.eh_membro(campanha_id) and (not compartilhada or public.eh_mestre(campanha_id)));
create policy "alterar notas próprias" on public.anotacoes for update to authenticated
  using (autor = auth.uid()) with check (autor = auth.uid() and (not compartilhada or public.eh_mestre(campanha_id)));
create policy "apagar notas próprias" on public.anotacoes for delete to authenticated using (autor = auth.uid());

create policy "ver as próprias sugestões" on public.sugestoes for select to authenticated using (autor = auth.uid() or public.sou_dev());
create policy "enviar sugestão" on public.sugestoes for insert to authenticated with check (autor = auth.uid());
create policy "desenvolvedor responde" on public.sugestoes for update to authenticated using (public.sou_dev()) with check (public.sou_dev());
create policy "desenvolvedor apaga" on public.sugestoes for delete to authenticated using (public.sou_dev());

/* ---------- permissões ---------- */
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select, update (nome) on public.perfis to authenticated;
grant select, insert, update, delete on public.contas to authenticated;
grant select, delete on public.personagens to authenticated;
grant select, delete on public.campanhas to authenticated;
grant select on public.participantes, public.elenco to authenticated;
grant select, insert, update, delete on public.anotacoes to authenticated;
grant select, insert, delete on public.sugestoes to authenticated;
grant update (situacao, resposta) on public.sugestoes to authenticated;

grant execute on function
  public.eh_membro(uuid), public.eh_mestre(uuid), public.mesma_mesa(uuid), public.sou_dev(),
  public.salvar_personagem(text, text, jsonb, integer),
  public.criar_campanha(text, text, text), public.editar_campanha(uuid, text, text),
  public.definir_senha(uuid, text), public.trocar_codigo(uuid), public.previa_campanha(text),
  public.entrar_campanha(text, text), public.adicionar_personagem(uuid, text),
  public.retirar_personagem(uuid), public.definir_situacao(uuid, text, text),
  public.sair_campanha(uuid), public.remover_participante(uuid, uuid), public.excluir_minha_conta()
to authenticated;
