# NEURO LAB — Como iniciar no dia da feira

Tudo roda da pasta do projeto (pode ser o pen drive). O único programa que o PC precisa ter é o **Node.js** (versão LTS, nodejs.org). O adb e o cloudflared já estão em `tools\`.

## 1. Escolher a rede do QR

O QR leva o visitante ao relatório no celular dele. Escolha **uma** opção:

| Opção | Quando usar | O celular do visitante precisa de |
|---|---|---|
| **Túnel** (recomendado) | O PC tem internet (Wi-Fi da escola **ou** hotspot) | Qualquer internet: dados móveis ou Wi-Fi |
| **Wi-Fi da escola** | Sem túnel, e a rede da escola deixa um aparelho falar com outro | Estar no **mesmo** Wi-Fi da escola |
| **Hotspot do Pedro** | Sem túnel e sem Wi-Fi da escola | Estar no hotspot do Pedro |

- [ ] Conectar o PC na rede escolhida (Wi-Fi da escola ou hotspot) **antes** do passo 2.

## 2. Rodar o INICIAR_FEIRA.bat

- [ ] Ligar o Quest e conectar o cabo USB-C no PC (se pedir **"Permitir depuração USB"** no headset → Permitir)
- [ ] Dar dois cliques em **`INICIAR_FEIRA.bat`** (na pasta do projeto)
- [ ] Na pergunta **"Usar túnel para o QR? (S/N)"**: **S** = túnel, **N** = Wi-Fi da escola ou hotspot
- [ ] No final aparece em amarelo o **ENDEREÇO DO QR CODE**:
  - Túnel → `https://...trycloudflare.com`
  - Rede local → `http://192.168.x.x:3000` (**não** pode ser `localhost`)
- [ ] O Chrome abriu sozinho o HUD (`localhost:3000`) e o painel (`localhost:3000/painel/coletivo.html`) — arraste o painel para o segundo monitor
- [ ] Apertar **F11** (tela cheia) no HUD — em notebook 1366×768, sem tela cheia o topo do resultado fica cortado
- [ ] HUD, painel e VR só abrem **neste PC** (e no Quest pelo cabo). Celulares e outros aparelhos só abrem o relatório do QR
- [ ] Se o Windows perguntar sobre o Firewall → **Permitir acesso** (redes privadas e públicas)

O .bat faz sozinho: confere o Node, acha o Quest no `adb` (mesmo com a webcam USB conectada junto), roda o `adb reverse`, desliga o sensor de proximidade do Quest, abre o túnel (se **S**), inicia o servidor e abre as telas. Se algo falhar, ele mostra o que fazer e a janela **não fecha**.

> Não feche as janelas **"NEURO LAB - SERVIDOR"** e **"NEURO LAB - TUNEL"** durante a feira. Cada vez que o túnel é aberto de novo o endereço muda, e os QR já entregues param de funcionar — rode o .bat **uma vez só** por dia.

## 3. Quest 3S

- [ ] No Quest, abrir o **Meta Browser** e acessar: `localhost:3000/vr/lab.html`
- [ ] Deixar essa aba aberta durante toda a feira — **recarregar (↻) entre um visitante e outro**

## 4. Teste antes de abrir para o público

- [ ] Fazer um scan completo no PC
- [ ] Clicar **ENTRAR**
- [ ] O Quest mostrou a emoção do scan
- [ ] Escanear o QR com um celular **(túnel: com os dados móveis, Wi-Fi desligado)**
- [ ] O relatório abriu

## 5. Antes do primeiro dia

- [ ] Dar dois cliques em **`LIMPAR_SESSOES.bat`** → **S**. Ele guarda uma cópia (`data\sessions_backup_AAAA-MM-DD_HH-MM-SS.json`) e zera as sessões de teste — o painel começa do zero.

## Plano B rápido

| Problema | Ação |
|---|---|
| Servidor travou | Na janela **"NEURO LAB - SERVIDOR"**: `Ctrl+C` → digitar `node server.js` → Enter. O endereço do QR continua o mesmo |
| Túnel não abriu / QR do túnel não abre | Fechar as janelas do NEURO LAB, rodar o .bat de novo e responder **N** (Wi-Fi da escola ou hotspot) |
| Quest não aparece | Desconectar e reconectar o cabo → no .bat escolher **T** (tentar de novo) |
| Quest desconectou no meio da feira | Reconectar o cabo. No cmd da pasta do projeto: `tools\platform-tools\adb devices -l` → copiar o número da linha com `model:Quest...` → `tools\platform-tools\adb -s NUMERO reverse tcp:3000 tcp:3000` (use sempre o `-s` com o número do Quest; a webcam USB pode continuar conectada). Não rode o .bat de novo: com túnel o endereço do QR mudaria |
| "A porta 3000 já está em uso" | O servidor já está aberto em outra janela — use essa, ou feche-a e rode o .bat de novo |
| QR (rede local) não abre no celular | Celular na **mesma** rede do PC? Firewall liberado? O Wi-Fi da escola pode bloquear aparelho↔aparelho → use túnel ou hotspot |
| Câmera não liga no scan | Tela do scan tem que estar em `http://localhost:3000` (pelo IP o Chrome bloqueia a câmera) |
