"""
NEURO LAB — gerar_narracao.py
Gera os MP3 da narração do VR (vr/audio/) com a voz neural gratuita da
Microsoft via edge-tts. Precisa de internet só na hora de gerar.

    python -m pip install --user edge-tts
    python gerar_narracao.py            # gera todos
    python gerar_narracao.py 02 12      # regera só os que começam com 02 ou 12

Os nomes precisam bater com a TIMELINE de vr/lab.html.
"""
import asyncio
import hashlib
import os
import struct
import sys

import edge_tts
import edge_tts.communicate
import edge_tts.drm


# ── AJUSTE TEMPORÁRIO: token Sec-MS-GEC v2 ─────────────────────────────
# Desde ~10/10/2026 o serviço só aceita o token v2 e o edge-tts 7.2.8
# ainda envia o v1 (erro 403). Algoritmo do PR rany2/edge-tts#492, ainda
# não publicado. Quando sair uma versão do edge-tts que já use v2, este
# bloco se desliga sozinho (checagem de SEC_MS_GEC_VERSION abaixo).
_M32 = 0xFFFFFFFF


def _rol16(v):
    v &= _M32
    return ((v << 16) | (v >> 16)) & _M32


def _palavras(data):
    data += b"\x00" * ((-len(data)) % 4)
    w = list(struct.unpack(f"<{len(data) // 4}I", data))
    return w + [0] if len(w) % 2 else w


def _cs64_word_swap(w, k):
    a, b = k[0] | 1, k[1] | 1
    acc = last = 0
    for x, y in zip(w[0::2], w[1::2]):
        t = _rol16((_rol16(x) * 0xEF0569FB + x * a) & _M32)
        q = (t * 0x76F50F34) & _M32
        acc = (acc + ((_rol16(q) * 0xC3EFEA97 + q) & _M32)) & _M32
        t = _rol16((_rol16(y) * 0xC31713DB + y * b) & _M32)
        q = (t * 0x1881CE3C) & _M32
        last = (_rol16(q) * 0x35BD1EC9 + q) & _M32
        acc = (acc + last) & _M32
    return last, acc


def _cs64_reversible(w, k):
    a, b = k[0] | 1, k[1] | 1
    state = acc = 0
    for x, y in zip(w[0::2], w[1::2]):
        state = ((state + x) * a) & _M32
        for c in (0xCF98B111, 0x87085B9F, 0x12CEB96D, 0x257E1D83):
            state = (_rol16(state) * c) & _M32
        t = ((y + state) * b) & _M32
        t = (_rol16(t) * 0xA27416F5) & _M32
        t = _rol16((_rol16(t) * 0xD38396FF) & _M32)
        acc = (acc + state) & _M32
        state = (_rol16((t * 0x7C932B89) & _M32) * 0xBFA49F69) & _M32
        acc = (acc + state) & _M32
    return state, acc


def _token_v2():
    ticks = edge_tts.drm.DRM.get_unix_timestamp() + edge_tts.drm.WIN_EPOCH
    ticks -= ticks % 300
    ticks *= edge_tts.drm.S_TO_NS / 100
    dados = (b"Copyright (C) Microsoft Corporation. All rights reserved."
             + f"{ticks:.0f}{edge_tts.drm.TRUSTED_CLIENT_TOKEN}".encode("ascii"))
    digest = hashlib.sha256(dados).digest()
    w, k = _palavras(dados), _palavras(digest)
    a, b = _cs64_word_swap(w, k), _cs64_reversible(w, k)
    return struct.pack("<II", a[0] ^ b[0], a[1] ^ b[1]).hex().upper() + "-" + digest.hex().upper()


if edge_tts.communicate.SEC_MS_GEC_VERSION.startswith("1-"):
    edge_tts.drm.DRM.generate_sec_ms_gec = staticmethod(_token_v2)
    edge_tts.communicate.SEC_MS_GEC_VERSION = "2-" + edge_tts.communicate.SEC_MS_GEC_VERSION[2:]
# ───────────────────────────────────────────────────────────────────────

VOZ  = "pt-BR-FranciscaNeural"
RATE = "-10%"
PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vr", "audio")

FALAS = {
    "01_boas_vindas":       "Bem-vindo ao NEURO LAB.",
    "02_laboratorio":       "Este é um laboratório de saúde do futuro, onde a tecnologia percebe sinais antes que eles virem problemas.",
    "03_olhe_ao_redor":     "Olhe ao seu redor. Estes painéis mostram como a tecnologia poderá acompanhar a saúde no futuro.",
    "04_emocao_feliz":      "Durante o scan, sua expressão mostrou sinais de alegria.",
    "04_emocao_tranquilo":  "Durante o scan, sua expressão mostrou sinais de tranquilidade.",
    "04_emocao_surpreso":   "Durante o scan, sua expressão mostrou sinais de surpresa.",
    "04_emocao_triste":     "Durante o scan, sua expressão mostrou sinais de reflexão.",
    "04_emocao_irritado":   "Durante o scan, sua expressão mostrou sinais de tensão.",
    "04_emocao_apreensivo": "Durante o scan, sua expressão mostrou sinais de apreensão.",
    "04_emocao_incomodado": "Durante o scan, sua expressão mostrou sinais de desconforto.",
    "04_emocao_generica":   "Seu estado foi registrado. Vamos explorar este momento juntos.",
    "05_nao_diagnostico":   "Isto não é um diagnóstico. É um retrato deste momento, e nenhuma imagem sua foi gravada.",
    "06_respirar":          "Agora olhe para a esfera à sua frente. Vamos respirar juntos.",
    "07_inspire":           "Inspire devagar.",
    "08_segure":            "Segure.",
    "09_solte_devagar":     "Agora solte, bem devagar.",
    "10_de_novo":           "De novo. Inspire.",
    "11_solte":             "Solte.",
    "12_reflexao":          "Você acabou de dedicar um minuto a você. Isso também é cuidar da saúde.",
    "13_tire_oculos":       "Pode tirar o óculos. Seu relatório te espera no QR code.",
}

# Rate por arquivo, se alguma fala precisar caber num intervalo menor
RATE_POR_ARQUIVO = {
    "03_olhe_ao_redor": "+0%",  # a -10% a voz ia até 6,37s; a janela é de 6s (10s → 16s)
}


async def gerar(nome, texto):
    destino = os.path.join(PASTA, nome + ".mp3")
    rate = RATE_POR_ARQUIVO.get(nome, RATE)
    await edge_tts.Communicate(texto, VOZ, rate=rate).save(destino)
    # edge-tts entrega MP3 CBR 48 kbps → duração ≈ bytes × 8 / 48000
    dur = os.path.getsize(destino) * 8 / 48000
    print(f"  {nome + '.mp3':28} {dur:5.2f}s  (rate {rate})")


async def main():
    os.makedirs(PASTA, exist_ok=True)
    filtros = sys.argv[1:]
    alvos = {n: t for n, t in FALAS.items() if not filtros or any(n.startswith(f) for f in filtros)}
    print(f"Gerando {len(alvos)} arquivo(s) em {PASTA} — voz {VOZ}")
    for nome, texto in alvos.items():  # um por vez: o serviço recusa muitas conexões simultâneas
        await gerar(nome, texto)


if __name__ == "__main__":
    asyncio.run(main())
