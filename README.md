# NEURO LAB — Laboratório de Saúde Digital

![NEURO LAB: scan de expressão facial, laboratório em realidade virtual e relatório de bem-estar](docs/imagens/capa-link.png)

O **NEURO LAB** é um projeto acadêmico desenvolvido para a **EXPOTEC 2026 da FORTEC**, com o tema saúde, bem-estar e tecnologia. A experiência tem três etapas: **scan de expressão facial**, **laboratório em realidade virtual** e **relatório**.

Na feira, o projeto funcionou com um servidor Node.js no notebook e com o Meta Quest 3S. Este repositório traz uma **versão de demonstração** que funciona sem servidor, para qualquer pessoa testar pelo navegador, e preserva a **versão usada na feira** na pasta [`versao-feira/`](versao-feira/).

> **Aviso:** projeto acadêmico com finalidade educativa. Não realiza diagnóstico. As imagens da câmera são processadas no próprio aparelho e não são salvas nem enviadas.

## Demonstração online

**https://pedroluccagarola.github.io/neurolab/**

| Autoavaliação | Resultado | Como a IA chegou nisso | Relatório |
|---|---|---|---|
| ![Pergunta "Como você se sente agora?" com a escala de 1 a 5](docs/imagens/interface-autoavaliacao.png) | ![Painel de resultado com o QR code do relatório](docs/imagens/interface-resultado.png) | ![Explicação com as 7 expressões, a calibração e o limite da IA](docs/imagens/interface-explicacao.png) | ![Relatório no celular com a autoavaliação de antes e de depois](docs/imagens/relatorio.png) |

| Laboratório VR com legendas | Respiração guiada |
|---|---|
| ![Painéis ilustrativos do laboratório VR com a legenda da narração](docs/imagens/vr-legendas.png) | ![Esfera da respiração guiada com a legenda "Inspire devagar."](docs/imagens/vr-respiracao.png) |

*As porcentagens das capturas são valores de exemplo.*

## Funcionalidades

- **Autoavaliação antes e depois:** a pergunta "Como você se sente agora?" (de 1 a 5) aparece antes do scan e no fim do VR. A resposta é opcional, e o relatório compara as duas.
- **Scan de expressão facial:** a webcam estima, no próprio navegador, 7 expressões faciais (alegria, tranquilidade, surpresa, tristeza, irritação, apreensão e desconforto). O resultado é a média de 5 leituras, com uma calibração para a expressão neutra. A câmera é desligada logo após a captura.
- **Pular scan:** quem não quer ou não pode usar a câmera escolhe uma emoção e segue a demonstração.
- **Como a IA chegou nisso:** mostra as 7 porcentagens, explica a calibração com os números do resultado e deixa claro o limite: a IA lê expressões do rosto, não sentimentos.
- **Laboratório em realidade virtual:** cerca de um minuto, com narração, legendas sincronizadas e respiração guiada no ritmo 4-4-6 (inspirar 4 s, segurar 4 s e soltar 6 s), acompanhando uma esfera de luz. Funciona no computador, no celular e no Meta Quest.
- **Relatório:** a autoavaliação de antes e de depois, a expressão em destaque e uma dica prática, em cerca de uma tela de celular. Abre no celular pelo QR code, e nada é gravado em servidor.

## Como usar

1. Abra o link da demonstração.
2. Escolha uma das opções. Antes de começar, a página pergunta **"Como você se sente agora?"** (escala de 1 a 5); a resposta é opcional.
   - **Iniciar scan:** o navegador pede permissão para usar a câmera. Posicione o rosto na área indicada e aguarde a contagem. A câmera é desligada logo após a captura.
   - **Pular scan:** para quem não quer ou não pode usar a câmera. Basta escolher uma emoção para seguir a demonstração.
3. No painel de resultado:
   - **Abrir relatório** mostra o relatório nesta tela; o **QR code** abre o mesmo relatório no celular.
   - **Como a IA chegou nisso** mostra as 7 expressões estimadas, explica a calibração e os limites da IA (também disponível no relatório). Quando a calibração muda a expressão em destaque, o painel avisa com "Em destaque pela calibração · ver explicação".
   - **Entrar** abre o laboratório em realidade virtual.
4. No laboratório VR, clique em **Entrar no laboratório** com o som ligado:
   - **Computador:** arraste com o mouse para olhar ao redor.
   - **Celular:** gire o aparelho ou arraste com o dedo.
   - **Meta Quest:** abra o link no navegador do Quest; a sessão entra em VR imersivo.
   - **Legendas:** a narração tem legendas sincronizadas, ligadas por padrão. Para ligar ou desligar, use o botão **CC** (ou a tecla **C**) no computador e no celular, a opção na tela de entrada ou, no Quest, o botão **A** do controle.
5. Ao final, a mesma pergunta é feita de novo e a tela de encerramento leva ao relatório.
6. O relatório é organizado em camadas, para caber em cerca de uma tela de celular:
   - **No topo:** a autoavaliação de antes e de depois (com a diferença), a expressão em destaque em uma linha e **uma dica** para o resultado. Com resposta 1 ou 2, a dica é conversar com alguém de confiança, porque a resposta da própria pessoa vale mais que a leitura da IA; com resposta 1, aparece também o contato do CVV (188, ligação gratuita, ou cvv.org.br).
   - **Saiba mais** (fechado por padrão): "Como a IA chegou nisso", "Como funciona o NEURO LAB" e "O que vem por aí".
   - **No rodapé:** o aviso em uma linha.

O resultado fica apenas no endereço (URL) do relatório e do VR, por exemplo `relatorio/?e=happy:72,neutral:20,surprised:5&a=3&d=4` (`a` e `d` são as respostas de antes e de depois). Nenhum dado é gravado em servidor.

## Depois da feira

Depois da EXPOTEC, a demonstração online recebeu estas melhorias:

- **Autoavaliação antes e depois:** a pessoa responde "Como você se sente agora?" no início e no fim do VR, e o relatório compara as duas respostas. Com resposta 1 ou 2, a dica passa a ser conversar com alguém de confiança; com resposta 1, o relatório mostra também o contato do CVV.
- **Transparência da IA:** "Como a IA chegou nisso" mostra as 7 expressões estimadas, explica a calibração com os números do resultado e os limites do modelo.
- **Legendas no VR:** sincronizadas com a narração, ligadas por padrão e com opção para desligar.
- **Relatório simplificado:** o essencial cabe em uma tela (autoavaliação, expressão em destaque e uma dica); o restante fica em "Saiba mais".
- **Revisão de textos:** o site não afirma o que o sistema não faz. Ele fala em expressões do rosto, não em sentimentos; deixa claro que a autoavaliação não é uma medição; e marca as ideias futuristas do VR como ilustrativas ou como conceito.

Também ficaram maiores e com mais contraste os textos que precisam ser lidos, e o laboratório passou a ter um nome único: Laboratório de Saúde Digital.

## Tecnologias utilizadas

**Versão de demonstração (raiz do repositório)**

| Tecnologia | Uso |
|---|---|
| HTML, CSS e JavaScript (sem framework) | Interface, relatório e lógica da experiência |
| [face-api.js](https://github.com/justadudewhohacks/face-api.js) 0.22.2 (TensorFlow.js) | Detecção do rosto (Tiny Face Detector) e estimativa das expressões (Face Expression Net), executadas no navegador |
| [A-Frame](https://aframe.io/) 1.5.0 (three.js) e WebXR | Laboratório 3D e modo imersivo no Meta Quest |
| Web Audio API | Narração do VR e efeitos sonoros do scan |
| [qrcodejs](https://github.com/davidshimjs/qrcodejs) 1.0.0 | QR code do relatório, gerado no navegador |
| Fontes Rajdhani e Share Tech Mono | Identidade visual (arquivos locais) |
| GitHub Pages | Hospedagem estática |

A narração foi gerada previamente em MP3 com [edge-tts](https://github.com/rany2/edge-tts) (voz pt-BR-FranciscaNeural), pelo script `versao-feira/gerar_narracao.py`. Na demonstração, as falas 02 e 03 foram regravadas com a mesma voz e textos revisados: a 02 usa o nome único do laboratório ("Este é o Laboratório de Saúde Digital. Aqui, você conhece ideias de tecnologia para cuidar da saúde.") e a 03 trata as ideias futuristas como tema de pesquisa ("Estes painéis ilustram ideias que a pesquisa ainda explora"). A versão da feira mantém as falas originais.

**Versão da feira ([`versao-feira/`](versao-feira/))**

| Tecnologia | Uso |
|---|---|
| Node.js e Express | Servidor local: páginas, sessões, relatório e painel coletivo |
| Android Platform Tools (`adb reverse`) | Conexão do Meta Quest 3S ao servidor pelo cabo USB-C |
| cloudflared (Cloudflare Tunnel) | Endereço público temporário para o QR code abrir o relatório no celular do visitante |
| Meta Quest 3S (navegador do Quest) | Experiência em realidade virtual |

O servidor da feira tem integração opcional com a API da Anthropic para gerar o texto do relatório. Na feira, porém, o relatório usou o conteúdo offline já escrito (`api/fallback.json`), que é o mesmo usado na demonstração.

## Estrutura do repositório

```
neurolab/
├── index.html            Tela do scan (HUD)
├── js/
│   ├── scan.js           Detecção de expressões com face-api.js
│   ├── conteudo.js       Textos do relatório e leitura do resultado na URL
│   └── explicacao.js     "Como a IA chegou nisso" (painel e relatório)
├── relatorio/index.html  Relatório (em camadas)
├── vr/
│   ├── lab.html          Laboratório VR (A-Frame)
│   ├── audio/            Narração em MP3
│   └── lib/              A-Frame 1.5.0
├── lib/                  face-api.js, qrcodejs e fontes
├── models/               Modelos do face-api.js
├── docs/                 Capturas, capas e carrossel
└── versao-feira/         Versão apresentada na EXPOTEC 2026 (servidor Node.js)
```

## Executar localmente

A demonstração precisa ser aberta por um servidor HTTP (os modelos e os áudios são carregados por requisição). Na pasta do projeto, use um dos comandos:

```bash
npx serve .
# ou
python -m http.server 8080
```

Depois abra `http://localhost:8080` (ou o endereço indicado). A câmera só é liberada pelo navegador em `localhost` ou em endereços `https`.

Para executar a versão da feira, veja [`versao-feira/INICIAR_NEURO_LAB.md`](versao-feira/INICIAR_NEURO_LAB.md). Ela precisa de `npm install` e das ferramentas `adb` e `cloudflared` na pasta `versao-feira/tools/`, que não estão no repositório por serem programas de terceiros.

## Equipe

| Papel | Integrantes |
|---|---|
| Desenvolvimento | Pedro Lucca |
| Ideias e apresentação na EXPOTEC | Carlos Eduardo, Iori e Kauã |

## Como foi desenvolvido

O código foi escrito com o **Claude** como principal ferramenta de desenvolvimento. Pedro Lucca definiu a experiência, conduziu as etapas do desenvolvimento, testou cada versão, identificou os erros e tomou as decisões do projeto.

## Principais problemas resolvidos

**Conexão do Meta Quest sem rede compartilhada.** O Quest precisava abrir o laboratório VR servido pelo notebook, mas não havia garantia de uma rede compartilhada entre os dois: redes de escola costumam bloquear a comunicação entre aparelhos. A solução foi conectar o Quest por cabo USB-C e usar `adb reverse tcp:3000 tcp:3000`: o Quest acessa `localhost:3000` e a conexão chega ao servidor do notebook pelo cabo, sem depender do Wi-Fi. O script `INICIAR_FEIRA.bat` automatiza o processo (localiza o Quest entre os dispositivos USB, executa o `adb reverse` e desativa o sensor de proximidade para a tela não apagar entre visitantes). Como o Quest sempre abre o mesmo endereço, o botão **Entrar** do computador registra no servidor qual sessão deve ser exibida no óculos.

**Calibração da expressão neutra.** Com o rosto em repouso, o modelo tende a apontar "neutro" como expressão principal, mesmo quando há sinais leves de outra expressão. Foram definidas três regras: as demais expressões recebem um peso de 1,5 apenas para a ordenação; "neutro" só fica em destaque com pelo menos 70%; e outra expressão só assume o destaque com pelo menos 15%. As porcentagens exibidas continuam sendo as calculadas pelo modelo, e o resultado é a média de várias leituras seguidas.

**Linguagem acessível no relatório.** O relatório precisava ser entendido por visitantes de qualquer idade. Os textos do relatório, do painel e da narração falam em "sinais na expressão" em vez de afirmar o que a pessoa sente, evitam termos técnicos e diagnósticos e oferecem uma dica prática para aplicar no mesmo dia.

## Privacidade

- O vídeo da webcam é analisado pelo face-api.js no próprio navegador. Nenhum quadro é gravado, exportado ou enviado pela rede.
- A câmera só é ligada ao clicar em **Iniciar scan** e é desligada logo após a captura.
- O resultado (as porcentagens e, se a pessoa responder, a autoavaliação de 1 a 5) fica no endereço do relatório; não há banco de dados nem servidor na demonstração.
- A única informação guardada no navegador é a preferência de legendas (ligadas ou desligadas), que não sai do aparelho.
- Os dados das sessões da feira não fazem parte deste repositório.

## Aviso

O NEURO LAB é um projeto acadêmico com finalidade educativa. Não realiza diagnóstico e não substitui avaliação médica ou psicológica. Em caso de necessidade, procure um profissional de saúde qualificado.

## Créditos de terceiros

face-api.js (MIT), A-Frame (MIT), qrcodejs (MIT), fontes Rajdhani e Share Tech Mono (SIL Open Font License) e modelos pré-treinados distribuídos com o face-api.js.
