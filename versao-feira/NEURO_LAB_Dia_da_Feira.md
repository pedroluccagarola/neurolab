# NEURO LAB — Guia do Dia da Feira

Guia para o operador seguir na Expotec. Siga na ordem. Se algo der errado, vá direto para o **Plano B** (seção 4).

---

## 1. Antes de sair de casa

- [ ] **Arquivo `.env`:** abrir o arquivo `.env` na pasta do projeto e confirmar que ele tem só a linha `PORT=3000`. Os textos do relatório vêm do modo offline (textos prontos) — não há chave de IA.
- [ ] **Quest carregado:** bateria em 100%.
- [ ] **Zerar as sessões de teste:** dois cliques em **`LIMPAR_SESSOES.bat`** → **S**. Ele guarda uma cópia
      (`data\sessions_backup_AAAA-MM-DD_HH-MM-SS.json`) e deixa `data\sessions.json` vazio — o painel coletivo começa do zero.
- [ ] **Se for usar outro PC:** copiar a pasta inteira do projeto (com `node_modules` e `tools`) para o pen drive.
      No outro PC, só precisa ter o **Node.js** instalado (versão LTS, nodejs.org).
- [ ] **Levar:**
  - Notebook + carregador (ou o pen drive com o projeto)
  - Cabo USB-C (para ligar o Quest no notebook)
  - Extensão / filtro de linha
  - Celular do Pedro (é o hotspot de reserva — precisa estar carregado ou com carregador)

---

## 2. Montagem na feira (nesta ordem)

### 2.1 Ligar tudo
1. Ligar o notebook e colocar na tomada.
2. Ligar o Quest e conectar no notebook pelo cabo USB-C.
   - Na **primeira vez** em cada PC, aparece uma mensagem **dentro do Quest** pedindo para "Permitir depuração USB". Coloque o headset e clique em **Permitir** (marque "sempre permitir deste computador").

### 2.2 Escolher a rede do QR
O QR leva o visitante ao relatório no celular dele. Há três jeitos — escolha um:

| Opção | O notebook precisa | O celular do visitante precisa | Resposta no .bat |
|---|---|---|---|
| **Túnel** (recomendado) | Internet (Wi-Fi da escola **ou** hotspot) | Qualquer internet — dados móveis ou Wi-Fi | **S** |
| **Wi-Fi da escola** | Estar no Wi-Fi da escola | Estar no **mesmo** Wi-Fi da escola | **N** |
| **Hotspot do Pedro** | Estar no hotspot | Estar no hotspot do Pedro | **N** |

- **Túnel:** o servidor ganha um endereço `https://...trycloudflare.com` que abre de qualquer lugar. Por ele **só abre o relatório** — HUD, painel, VR e dados ficam bloqueados para quem vem de fora.
- **Wi-Fi da escola:** muitas redes de escola bloqueiam um aparelho de falar com outro. Se o QR não abrir, use túnel ou hotspot.
- **Hotspot:** anote nome e senha no campo **"Wi-Fi para o QR"** (seção 3, passo 9) — os visitantes vão precisar.

3. Conectar o notebook na rede escolhida (Wi-Fi da escola ou hotspot).

### 2.3 Rodar o INICIAR_FEIRA.bat
4. Na pasta do projeto, dar dois cliques em **`INICIAR_FEIRA.bat`**. Ele faz tudo em ordem e mostra **OK** em verde a cada etapa:
   - **[1/5]** confere o Node.js;
   - **[2/5]** acha o Quest no USB (mesmo com outro aparelho Android, como um celular, conectado junto), roda o `adb reverse` e desliga o sensor de proximidade (a tela do Quest não apaga entre um visitante e outro);
   - **[3/5]** pergunta **"Usar túnel para o QR? (S/N)"** — responda conforme a tabela acima;
   - **[4/5]** inicia o servidor numa janela própria;
   - **[5/5]** abre no Chrome o HUD (`http://localhost:3000`) e o painel (`http://localhost:3000/painel/coletivo.html`).
   - Se o Windows perguntar sobre o Firewall, clique em **Permitir acesso** (marque redes privadas **e** públicas).
   - Se algo falhar, aparece **ERRO** em vermelho com o que fazer, e a janela **não fecha**. Se o Quest não for encontrado, ele oferece **[T] tentar de novo** ou **[C] continuar sem o Quest**.
5. **Não feche** as janelas **"NEURO LAB - SERVIDOR"** e **"NEURO LAB - TUNEL"** durante a feira.
   - ⚠️ Rode o .bat **uma vez só** por dia. Cada túnel novo tem outro endereço, e os QR já entregues param de abrir.

### 2.4 Conferir o endereço do QR
6. No final, o .bat mostra em amarelo o **ENDEREÇO DO QR CODE**:
   - Túnel → `https://...trycloudflare.com`
   - Wi-Fi da escola / hotspot → `http://192.168.x.x:3000`
7. Se aparecer `localhost` (aviso vermelho): o notebook não está em nenhuma rede. Conecte no Wi-Fi ou hotspot —
   o servidor passa a usar o IP novo sozinho, não precisa reiniciar.
   - Só se o IP escolhido estiver errado (ex.: pegou um adaptador que não é o do Wi-Fi):
     abrir o `.env`, acrescentar a linha `LOCAL_IP=192.168.43.120` (com o IP certo do `ipconfig`) e rodar o .bat de novo.

### 2.5 Telas
8. **Tela principal (scan)** — já aberta pelo .bat: `http://localhost:3000`
   ✅ **Sempre `localhost`.** É assim que o Chrome libera a câmera. O QR já aponta sozinho para o endereço certo.
   - Apertar **F11** (tela cheia) no HUD. Em notebook 1366×768, sem tela cheia o topo do resultado fica cortado.
9. **Painel coletivo** — já aberto pelo .bat: arraste a janela para o segundo monitor (pode apertar F11 nele também).
   - HUD, painel e VR só abrem **neste notebook** (e no Quest pelo cabo). Celulares, TVs e outros aparelhos da rede só conseguem abrir o relatório do QR.
10. **Quest** — abrir o **Meta Browser** dentro do headset e acessar:
    `localhost:3000/vr/lab.html`
    (No Quest também é `localhost`, porque ele usa o cabo.)

> Scan, fontes, modelos, VR e os textos do relatório (modo offline) rodam do notebook, sem internet. A internet só é usada pelo túnel, para o celular do visitante abrir o relatório.

### 2.6 Teste completo antes de abrir ao público
11. Fazer um visitante de teste do começo ao fim (seção 3), conferindo:
    - [ ] O scan mostra as emoções
    - [ ] Aparece o QR code
    - [ ] Depois de clicar ENTRAR, a tela do Quest mostra **"SESSÃO …"** e a emoção do scan
    - [ ] O VR roda a sessão de 1 minuto com narração
    - [ ] O QR abre o relatório num celular — **túnel:** com os dados móveis (Wi-Fi do celular desligado); **rede local:** com o celular na mesma rede
    - [ ] O painel coletivo mostra 1 visitante

---

## 3. Atendimento ao visitante (roteiro)

1. **Convidar** o visitante para a experiência.
2. **Posicionar** a pessoa de frente para a câmera, rosto dentro da área indicada.
3. Clicar **INICIAR SCAN** e esperar o resultado.
4. **Mostrar o resultado** e explicar rapidamente as emoções.
5. Clicar **ENTRAR**. O botão muda para **"ENVIADO ✓"**.
6. **Entregar o Quest.** Confira que a tela de entrada mostra a emoção da pessoa e peça para ela tocar em **"ENTRAR NO LABORATÓRIO"**.
7. Enquanto o visitante está no VR, **mostrar o QR code** para quem está esperando e explicar a experiência.
8. **Receber o Quest de volta.**
9. Pedir para o visitante **escanear o QR** para levar o relatório e **tirar um print** (o link só funciona durante a feira).
   - **Túnel:** basta o celular ter internet (dados móveis ou qualquer Wi-Fi).
   - **Wi-Fi da escola / hotspot:** o celular precisa estar **conectado na mesma rede** do notebook antes de escanear.

   ```
   Wi-Fi para o QR (só sem túnel):
     Nome da rede: _______________
     Senha: _______________
   ```

   ⚠️ Faça isso **antes** do passo 11 — o botão PRÓXIMO VISITANTE apaga o QR da tela.
10. No Quest, **recarregar a página** (botão ↻ do navegador) para deixar pronto para o próximo.
11. Clicar **PRÓXIMO VISITANTE**.

> **Regra importante:** só clique ENTRAR quando a pessoa for colocar o Quest. O Quest sempre pega o **último** ENTRAR clicado.

---

## 4. Plano B

| Problema | O que fazer |
|---|---|
| **Quest não aparece no .bat** | Conferir se o Quest está ligado e o cabo conectado (troque de porta/cabo) e se a mensagem "Permitir depuração USB" foi aceita dentro do headset. Depois escolher **T** no .bat. |
| **Quest desconectou no meio da feira** | Reconectar o cabo. Abrir o **cmd** na pasta do projeto e rodar `tools\platform-tools\adb devices -l`. Copiar o número da linha com `model:Quest...` e rodar `tools\platform-tools\adb -s NUMERO reverse tcp:3000 tcp:3000` (o `-s` é obrigatório quando há outro aparelho Android no USB, como um celular). Recarregar a página no Quest. **Não** rode o .bat de novo — com túnel, o endereço do QR mudaria. |
| **Câmera não detecta o rosto** | Pedir para tirar óculos/boné, aproximar um pouco e melhorar a luz (rosto iluminado de frente, sem luz forte atrás). |
| **Servidor travou** (telas não respondem) | Na janela **"NEURO LAB - SERVIDOR"**: **Ctrl+C**, depois digitar `node server.js` e Enter. O endereço do QR (inclusive o do túnel) continua o mesmo. Recarregar as telas (F5) e a página no Quest. |
| **"A porta 3000 já está em uso"** | O servidor já está aberto em outra janela. Use essa janela, ou feche-a e rode o .bat de novo. |
| **Túnel não abriu** (erro no passo [3/5]) | O notebook está sem internet ou a rede bloqueia a Cloudflare. Responder **N** e usar Wi-Fi da escola ou hotspot. |
| **QR do túnel não abre no celular** | Testar o link com os dados móveis do celular. Se não abrir: fechar as janelas do NEURO LAB, rodar o .bat de novo e responder **N** (Wi-Fi da escola ou hotspot). |
| **QR da rede local não abre no celular** | 1) O celular do visitante está na **mesma rede** do notebook? (com dados móveis não funciona) 2) O endereço do QR mostrado pelo .bat é `http://192.168.x.x:3000` e não `localhost`? 3) O Firewall do Windows liberou o acesso? 4) O Wi-Fi da escola pode bloquear aparelho↔aparelho — troque para túnel ou hotspot. |
| **Câmera não liga** | A tela do scan tem que estar em `http://localhost:3000`. Pelo IP o Chrome bloqueia a câmera. |
| **IP mudou** (hotspot reiniciou, só sem túnel) | Nada a fazer: os próximos QR já saem com o IP novo. As telas continuam em `localhost`. (Se usou `LOCAL_IP` no `.env`, atualize e reinicie o servidor.) |
| **Quest mostra "Bem-vindo" sem a emoção** | Clicar ENTRAR de novo no notebook e recarregar a página no Quest. O VR genérico também funciona, se precisar seguir em frente. |

---

## 5. Encerramento

1. Fechar as janelas **"NEURO LAB - SERVIDOR"** e **"NEURO LAB - TUNEL"** (a partir daqui os links dos QR param de abrir).
2. No Quest, fechar o Meta Browser.
3. Desconectar o cabo USB-C do Quest e desligar o headset (ao reiniciar, o sensor de proximidade volta ao normal).
4. Desligar o hotspot e o notebook.

> Os dados das sessões ficam salvos em `data/sessions.json` — não apague essa pasta. Para zerar antes de um novo dia, use o `LIMPAR_SESSOES.bat` (ele guarda uma cópia antes).
