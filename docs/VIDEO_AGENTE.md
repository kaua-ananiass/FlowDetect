# Vídeo nativo e acesso por senha do Agent

O Agent captura o monitor principal com DXGI Desktop Duplication do Windows.
Os quadros NV12 passam por IPC local e são enviados ao Studio como vídeo WebRTC,
com preferência por H.264. Não há transmissão alternativa por JPEG no visualizador.
A aceleração do codec depende do WebView2, da GPU e dos drivers.

## Como usar

1. Instale Studio e Agent desta atualização nos respectivos computadores Windows.
2. No Agent, abra **Acesso não assistido**, defina e confirme uma senha com
   pelo menos 12 caracteres e ative o acesso.
3. No Studio, abra **Agentes → Físico**, cadastre o computador e abra a conexão
   por senha. Clique em **Buscar computadores**, selecione o Agent e informe a senha.
4. Salve e conecte à tela. O pareamento permanece autorizado neste Studio.

Ao iniciar novamente o Agent, a configuração de acesso é restaurada e o vídeo
fica disponível sem seletor de compartilhamento ou aprovação de cada conexão.
Esta atualização não configura inicialização automática com o Windows.
O botão local permite desativar o acesso; alterar a senha ou desativá-lo revoga
os pareamentos feitos por senha. Pareamentos anteriores por código são separados.

Ao ativar o acesso por senha, o Agent também libera mouse e teclado. O botão
**Mouse e teclado** no Agent bloqueia ambos e mantém a decisão ao reiniciar.
Instalações anteriores com acesso não assistido já ativo recebem essa liberação
na primeira abertura desta atualização, salvo uma decisão local já salva.
O Studio recebe confirmação de controle e mostra bloqueios ou erros do Windows.
Clique no vídeo remoto para direcionar a digitação; Escape devolve o foco ao Studio.
Se o programa de destino roda como administrador, o Agent também precisa estar
elevado para enviar entradas a ele. Isso não libera a tela segura do UAC.

## Proteção e limites

- PBKDF2-SHA256 com salt aleatório e 600 mil iterações.
- Verificador e credenciais de pareamento protegidos com DPAPI do usuário Windows.
- Desafio de uso único e concessão cifrada; cinco provas incorretas bloqueiam
  novas tentativas por 60 segundos. A senha não é salva no formulário do Studio.
- Sinalização autenticada e vídeo WebRTC cifrado, na rede local.
- A sessão Windows precisa estar aberta e desbloqueada. Não acessa a tela de
  login, a área de trabalho segura do UAC ou uma sessão encerrada.
- Captura do monitor principal; esta versão não compõe o cursor do Windows sobre
  o vídeo. Mouse e teclado remotos continuam disponíveis quando habilitados.
- Não inclui servidor, STUN/TURN externo ou acesso entre casas.

## Qualidade e validação

O limite é 1920×1080, com envio de até 60 FPS e perfis de 8, 12 ou 16 Mb/s.
Monitores menores não são ampliados para produzir 1080p artificial.
O Studio mostra resolução, FPS realmente decodificados, bitrate e RTT de rede.
RTT não mede toda a latência entre captura e exibição.

No PC de desenvolvimento, o teste do desktop nativo em loopback ficou em cerca
de **26–30 FPS em 1080p**, usando uma ponte binária local de teste. O teste
independente de transporte com fonte animada ultrapassou 30 FPS. Esses resultados
não garantem mínimo de 30 FPS na captura real entre dois computadores: GPU, CPU,
WebView2 e rede precisam ser validados no equipamento dedicado.

A captura mantém somente o quadro mais recente e libera os recursos após ficar
sem consumidor. Falhas encerram a sessão com uma mensagem; use **Reconectar tela**
após corrigir a causa. Atualize Studio e Agent juntos.
