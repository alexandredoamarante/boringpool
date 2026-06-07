# BORINGPOOL

**BORINGPOOL** é um jogo de sinuca em HTML5 Canvas com visual LCD monocromático refletivo, inspirado em minigames antigos/Brick Game, com física estável e polimento final de produto.

## Como rodar

1. Extraia o ZIP.
2. Abra `index.html` diretamente no navegador.
3. Na tela inicial, clique em `START`.
4. Mire com o mouse. Clique para travar a mira, arraste para definir a força e solte.

Não precisa instalar nada, não precisa de servidor e não usa dependências externas.

## Controles

- Mouse: mirar.
- Clique + arraste: definir força da tacada.
- Soltar: tacar.
- `NEW RACK`: reinicia a mesa.
- `CUE PLACE`: reposiciona a bola branca, limitado a 2 usos por rack.
- `LCD`: alterna a paleta monocromática.
- `SOUND ON/OFF`: liga/desliga sons 8-bit.

## Regras principais

- A bola 8 é sempre a última.
- Se a bola 8 cair antes da hora, ela volta para a mesa e gera penalidade.
- Combo só aparece quando 2 ou mais bolas caem na mesma tacada.
- A bola branca encaçapada gera penalidade de XP.
- As caçapas mantêm a física estável da versão final: sem sucção, sem raio escondido e com encaçapamento pelo contato real com o buraco preto visual.

## Recursos finais

- Tela inicial em estilo LCD.
- Branding final: `BORINGPOOL`.
- Sons 8-bit de sinuca via Web Audio API, sem arquivos de áudio externos.
- Estatísticas salvas no navegador:
  - BEST XP
  - RACKS CLEARED
  - TOTAL POTS
  - TOTAL SHOTS
  - CUE FOULS
  - 8 BALL FINISHES
  - BEST STREAK
  - BEST COMBO
  - FEWEST SHOTS CLEAR
  - BANK SHOTS
  - TOTAL PLAY TIME
- Conquistas salvas no navegador:
  - FIRST RACK
  - NO FOUL
  - BANK SHOT
  - COMBO x2
  - 8 BALL FINISH
  - PERFECT RACK
  - 10K XP
  - CUE MASTER
  - SHARPSHOOTER
  - LONG RUN
- Preferências salvas:
  - melhor pontuação;
  - tema LCD;
  - som ligado/desligado;
  - estatísticas;
  - conquistas.

## Arquivos

- `index.html`: estrutura da página, HUD, tela inicial, stats e conquistas.
- `style.css`: visual do console, temas LCD, scanlines, responsividade e painéis finais.
- `game.js`: Canvas, física, mira, regras, sons, estatísticas, conquistas e salvamento local.

## Observações da versão final

Esta versão preserva a jogabilidade e física já estabilizadas. O polimento adicionado é focado em experiência de produto: start screen, áudio opcional, estatísticas, conquistas e progresso salvo.
