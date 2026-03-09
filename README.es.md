[English](README.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md) | [Français](README.fr.md)

# cc-costline

Statusline mejorada para [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — añade seguimiento de costos, límites de uso y ranking en tu terminal.

![Captura de pantalla cc-costline](screenshot.png)

```
14.6k ~ $2.42 / 40% by Opus 4.6 | 5h: 45% / 7d: 8% | 30d: $866 | #2/22 $67.0
```

## Instalación

```bash
npm i -g cc-costline && cc-costline install
```

Abre una nueva sesión de Claude Code y verás la statusline mejorada. Requiere Node.js >= 22.

## Funcionalidades

| Segmento | Ejemplo | Descripción |
|----------|---------|-------------|
| Tokens ~ Costo / Contexto | `14.6k ~ $2.42 / 40% by Opus 4.6` | Tokens de la sesión, costo, uso de contexto y modelo |
| Límites de uso | `5h: 45% / 7d: 8%` | Utilización de Claude a 5 horas y 7 días (coloreado como el contexto). Al 100%, muestra cuenta regresiva: `5h:-3:20` |
| Costo del período | `30d: $866` | Costo acumulado (configurable: 7d o 30d) |
| Ranking | `#2/22 $67.0` | Posición en [ccclub](https://github.com/mazzzystar/ccclub) (si está instalado) |

### Colores

- **Contexto y límites de uso** — verde (< 60%) → naranja (60-79%) → rojo (≥ 80%)
- **Posición en ranking** — 1.o: dorado, 2.o: blanco, 3.o: naranja, resto: cian
- **Costo del período** — amarillo

### Integraciones opcionales

- **Límites de uso de Claude** — lee automáticamente las credenciales OAuth del llavero de macOS. Solo ejecuta `claude login`.
- **Ranking ccclub** — instala [ccclub](https://github.com/mazzzystar/ccclub) (`npm i -g ccclub && ccclub init`). El ranking aparece automáticamente.

Ambas funcionan sin configuración: si no están disponibles, el segmento se oculta silenciosamente.

## Comandos

```bash
cc-costline install              # Configurar la integración con Claude Code
cc-costline uninstall            # Eliminar de la configuración
cc-costline refresh              # Recalcular manualmente la caché de costos
cc-costline config --period 7d   # Mostrar costo de 7 días (por defecto)
cc-costline config --period 30d  # Mostrar costo de 30 días
cc-costline config --period both # Mostrar ambos períodos
```

## Cómo funciona

1. `install` configura `~/.claude/settings.json` — establece el comando de statusline y añade hooks de fin de sesión para la actualización automática. Tu configuración existente se conserva.
2. `render` lee el JSON de stdin de Claude Code y la caché de costos, y genera la statusline formateada.
3. `refresh` escanea `~/.claude/projects/**/*.jsonl`, extrae el uso de tokens, aplica precios por modelo y escribe en `~/.cc-costline/cache.json`.
4. El uso de Claude se obtiene de `api.anthropic.com/api/oauth/usage`, cacheado por sesión con un TTL de 10 minutos en `/tmp/sl-claude-usage`.
5. El ranking de ccclub se obtiene de `ccclub.dev/api/rank`, cacheado por sesión con un TTL de 10 minutos en `/tmp/sl-ccclub-rank`.

<details>
<summary>Tabla de precios</summary>

Precios por millón de tokens (USD):

| Modelo | Entrada | Salida | Escritura caché | Lectura caché |
|--------|--------:|-------:|----------------:|--------------:|
| Opus 4.6 | $5 | $25 | $6.25 | $0.50 |
| Opus 4.5 | $5 | $25 | $6.25 | $0.50 |
| Opus 4.1 | $15 | $75 | $18.75 | $1.50 |
| Sonnet 4.5 | $3 | $15 | $3.75 | $0.30 |
| Sonnet 4 | $3 | $15 | $3.75 | $0.30 |
| Haiku 4.5 | $1 | $5 | $1.25 | $0.10 |
| Haiku 3.5 | $0.80 | $4 | $1.00 | $0.08 |

Los modelos desconocidos usan el precio de su familia, Sonnet por defecto.

</details>

## Desarrollo

```bash
npm test    # Build + ejecutar tests unitarios (node:test, sin dependencias)
```

## Desinstalación

```bash
cc-costline uninstall
npm uninstall -g cc-costline
```

## Agradecimientos

- [ccclub](https://github.com/mazzzystar/ccclub) por 碎瓜 ([@mazzzystar](https://github.com/mazzzystar)) — ranking de Claude Code entre amigos

## Licencia

MIT
