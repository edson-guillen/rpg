-- Pedidos de privacidade pela aba Sugestões e retenção curta dos registros de tentativa.

alter table public.sugestoes drop constraint sugestoes_tipo_check;
alter table public.sugestoes add constraint sugestoes_tipo_check check (tipo in ('ideia', 'erro', 'regra', 'privacidade'));

create or replace function public.limpar_tentativas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.tentativas_entrada t where t.em < now() - interval '24 hours';
  return new;
end $$;
create trigger limpar_tentativas_antigas after insert on public.tentativas_entrada
  for each statement execute function public.limpar_tentativas();
revoke execute on function public.limpar_tentativas() from public, anon, authenticated;
