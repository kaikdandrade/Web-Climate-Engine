# Web Climate Engine

Uma engine visual de efeitos climáticos feita com **HTML, CSS e JavaScript puro**, usando `canvas` para desenhar partículas atmosféricas em tempo real. O projeto inclui uma página de demonstração com controles para alternar climas, ajustar intensidade, configurar vento e pausar a animação.

🔗 **Demo:** https://kaikdandrade.github.io/Web-Climate-Engine/

## ✨ Recursos

- Efeitos climáticos renderizados em `canvas`.
- Código em JavaScript puro, sem dependências obrigatórias para execução local.
- Controle de intensidade dos efeitos.
- Controle de força e direção do vento nos climas compatíveis.

* DOCS:
* Interface de teste com painel de controle.
* Botão de pausa/retomada da animação.
* Mensagem elegante para telas pequenas, recomendando o uso em tela maior ou modo “Exibir como computador”.

## 🌦️ Climas disponíveis

- **Sunny** — clima ensolarado com sol, aura e partículas de luz.
- **Rain** — chuva leve com gotas, aceleração e respingos.
- **Storm** — tempestade com chuva forte, relâmpagos e atmosfera escura.
- **Snow** — neve com flocos desenhados e acúmulo visual no chão.
- **Autumn Breeze** — vendaval horizontal com folhas de outono.
- **Gale of Petals** — rajada mística de pétalas.
- **Sandstorm** — tempestade de areia com partículas e elementos de deserto.

## 📁 Estrutura do projeto

```text
Web-Climate-Engine/
├── Climate.js
├── README.md
└── docs/
    ├── index.html
    ├── style.css
    ├── main.js
    └── favicon.ico
```

## 🚀 Como testar localmente

Clone o repositório:

```bash
git clone https://github.com/kaikdandrade/Web-Climate-Engine.git
cd Web-Climate-Engine
```

Abra o arquivo `docs/index.html` no navegador ou use uma extensão/servidor local, como o **Live Server** do VS Code.

## 🧩 Como usar a engine em outro projeto

Adicione um `canvas` ao HTML:

```html
<canvas id="climateCanvas"></canvas>
```

Carregue o arquivo `Climate.js`:

```html
<script src="./Climate.js"></script>
```

Ou use via CDN apontando para este repositório:

```html
<script src="https://cdn.jsdelivr.net/gh/kaikdandrade/Web-Climate-Engine@main/Climate.js"></script>
```

Inicialize a engine:

```html
<script>
  const canvas = document.getElementById("climateCanvas");
  const climate = new Climate({ canvas });

  function resize() {
    climate.resize(
      window.innerWidth,
      window.innerHeight,
      Math.min(window.devicePixelRatio || 1, 2)
    );
  }

  function loop(timestamp) {
    climate.tick(timestamp);
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);

  resize();
  climate.setClimate("rain");
  climate.setIntensity(60);
  climate.setWindPower(30);
  climate.setWindDirection("right");

  requestAnimationFrame(loop);
</script>
```

## ⚙️ API básica

### `new Climate({ canvas, onFlash })`

Cria uma nova instância da engine.

- `canvas`: referência do elemento `<canvas>` onde os efeitos serão renderizados.
- `onFlash`: função opcional chamada em efeitos de clarão, como relâmpagos.

### `setClimate(climate)`

Altera o clima atual.

Valores aceitos:

```js
"sunny"
"rain"
"storm"
"snow"
"autumn"
"petals"
"sandstorm"
```

### `setIntensity(value)`

Define a intensidade do clima, de `1` a `100`.

```js
climate.setIntensity(75);
```

### `setWindPower(value)`

Define a força do vento, de `0` a `100`.

```js
climate.setWindPower(40);
```

### `setWindDirection(value)`

Define a direção do vento nos climas compatíveis.

Valores principais:

```js
"right"
"left"
```

### `setPaused(paused)` e `togglePaused()`

Controlam a pausa da animação.

```js
climate.setPaused(true);
climate.togglePaused();
```

### `resize(width, height, dpr)`

Atualiza o tamanho interno do canvas. Use sempre que a janela mudar de tamanho.

```js
climate.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
```

### `tick(timestamp)`

Atualiza e desenha o frame atual. Deve ser chamado dentro de `requestAnimationFrame`.

```js
function loop(timestamp) {
  climate.tick(timestamp);
  requestAnimationFrame(loop);
}
```

## 🛠️ Tecnologias

- HTML5
- CSS3
- JavaScript puro
- Canvas API
- GitHub Pages

## 📌 Observações

Este projeto é ideal para estudos de animações em canvas, partículas, efeitos atmosféricos e interfaces visuais interativas sem frameworks.

## 📄 Licença

Este projeto está licenciado sob a licença MIT. Consulte o arquivo [`LICENSE`](LICENSE) para mais detalhes.
