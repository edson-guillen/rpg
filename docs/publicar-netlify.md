# Publicar o site com contas e campanhas

O GitHub Pages continua como versão sem conta. O site completo usa a **Netlify** (páginas) e o **Supabase** (login, banco e permissões). Os dois têm plano gratuito.

## 1. Supabase

1. Crie um projeto em supabase.com. Guarde a senha do banco.
2. Em **SQL Editor**, cole e rode `supabase/migrations/20261107000000_mesas.sql`.
3. Em **Project Settings > API**, copie a *Project URL* e a chave *anon* (ou *publishable*).
4. Ainda no SQL Editor, registre quem vê o painel de sugestões, com o e-mail da conta Google:

   ```sql
   insert into public.desenvolvedores (email) values ('seu-email@gmail.com');
   ```

## 2. Google

1. Em console.cloud.google.com, crie um projeto e abra **Google Auth Platform**.
2. Configure a tela de consentimento como *Externo*, com os escopos `email` e `profile`.
3. Crie um cliente OAuth do tipo *Aplicativo da Web*, com este URI de redirecionamento: `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
4. No Supabase, em **Authentication > Providers > Google**, ative e cole o ID e o segredo do cliente.

## 3. Netlify

1. Em **Add new site > Import an existing project**, escolha o repositório `edson-guillen/rpg`, branch `main`. O `netlify.toml` já define o build.
2. Em **Environment variables**, crie `SUPABASE_URL` e `SUPABASE_ANON_KEY` e publique.
3. No Supabase, em **Authentication > URL Configuration**, coloque o endereço da Netlify em *Site URL* e também em *Redirect URLs*.

## Trazer as fichas atuais

Os dados do GitHub Pages ficam no navegador daquele endereço. No site antigo, use **Exportar tudo**. No novo, entre na conta e use **Importar backup**.

## Testar em ambiente local

```bash
npx supabase start
npm run test:nuvem
npx supabase stop
```

## Privacidade

`privacidade.html` e `termos.html` são publicados com o site. Em Configurações há correção do nome, cópia dos dados e exclusão da conta.

## O que o servidor guarda

Nome da conta do Google, e-mail (só na autenticação), fichas, anotações, campanhas e sugestões. A chave anon é pública por natureza: quem protege os dados são as regras de acesso (RLS) em `supabase/migrations`, testadas em `tests/nuvem-regras.mjs`. A biblioteca pessoal nunca sobe: as magias dela vão na ficha só com nome e mecânica, sem o texto.
