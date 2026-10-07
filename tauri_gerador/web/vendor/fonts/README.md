# Fontes da captura do fluxo

Estes WOFF2 são os subconjuntos `latin` das famílias usadas pelo Studio.
`fonts.css` os carrega localmente na interface, inclusive no instalador offline.
Eles também são incorporados ao SVG/PNG exportado quando a família correspondente
está carregada no mapa original, evitando a troca por uma fonte genérica no
`foreignObject`.

| Arquivo | Família e pesos | Fonte |
| --- | --- | --- |
| `montserrat-latin.woff2` | Montserrat 500–900 | [Google Fonts, v31](https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2) |
| `plus-jakarta-sans-latin.woff2` | Plus Jakarta Sans 400–800 | [Google Fonts, v12](https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2) |
| `cormorant-garamond-latin.woff2` | Cormorant Garamond 600–700 | [Google Fonts, v21](https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtK.woff2) |

As licenças SIL Open Font License de cada família estão nos arquivos `*-OFL.txt`
desta pasta, obtidos do [repositório Google Fonts](https://github.com/google/fonts).
