TAÇA SG VÔLEI — VERSÃO ONLINE

O pacote está preparado para:
• página pública responsiva;
• categorias Feminino (4ª edição) e Masculino (1ª edição);
• jogos agendados, ao vivo e finalizados;
• classificação automática;
• login de administrador;
• cadastro de equipes e partidas;
• atualização em tempo real via Supabase Realtime;
• publicação estática na Vercel.

PASSOS PARA ATIVAR:
1. Crie um projeto gratuito no Supabase.
2. Abra o SQL Editor e execute todo o conteúdo de schema.sql.
3. Em Authentication > Users, crie o usuário administrador (e-mail e senha).
4. Em Project Settings > API, copie:
   - Project URL
   - anon / public key
5. Cole os valores em config.js.
6. Publique esta pasta na Vercel.

IMPORTANTE
A chave anon do Supabase pode ficar no front-end. A segurança real está nas políticas RLS do banco.
O site público só lê os dados; apenas usuários autenticados podem cadastrar ou alterar resultados.


ATUALIZAÇÃO — PATROCINADORES
• O Admin agora possui cadastro de patrocinadores com nome, logo e ordem de exibição.
• As logos são enviadas ao Supabase Storage e aparecem automaticamente no site público.
• Para atualizar um site que JÁ ESTÁ PUBLICADO, execute MIGRACAO_PATROCINADORES.sql no SQL Editor do mesmo projeto Supabase e depois publique os arquivos atualizados na Vercel.
• Não é necessário criar outro projeto Supabase.

ATUALIZAÇÃO — REGRAS DO CAMPEONATO
Para um projeto Supabase já existente, execute também MIGRACAO_REGRAS_CAMPEONATO.sql no SQL Editor.

O Admin agora permite:
- atribuir cada equipe à Chave A ou B (máximo de 4 por chave);
- gerar automaticamente os 12 jogos da fase de grupos (todos contra todos dentro de cada chave);
- lançar os pontos dos três sets e validar 21/21/15 com diferença mínima de 2;
- calcular automaticamente vitória 2x0 = 3 pontos; 2x1 = 2 para vencedor e 1 para perdedor;
- classificar por pontos e, em seguida, saldo de pontos;
- sinalizar quando um jogo de desempate é necessário;
- gerar automaticamente semifinais (1º A x 2º B e 1º B x 2º A) e a final.
