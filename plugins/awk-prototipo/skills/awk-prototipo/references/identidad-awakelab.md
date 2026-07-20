# Identidad Awakelab 2026 (brand-guideline-AWK-2026)

Aplicar SIEMPRE en los prototipos HTML. Sustituye por completo al estilo anterior — **NO usar**: tipografía Rubik, navy `#2E4053`, teal `#3EBFC7`, azul `#2E76F5`.

## Tipografía

**Poppins** en todo (titulares, cuerpo y UI), importada desde Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

```css
font-family: 'Poppins', sans-serif;
```

## Paleta

### Cianes vivos — acentos, CTAs, datos destacados, destellos

`#D9FBFF` · `#19F7F1` · `#11EAEA` · `#0FCED3` · `#0ABCC9` · `#0B93AA`

### Azules profundos — fondos y jerarquía

- Claros (superficies suaves): `#F0F3FC` · `#E2E6F2`
- Medios: `#72A3C4` · `#4E7EA5` · `#3B6996` · `#34547A` · `#314668` · `#27334F`
- Oscuros (fondos principales): `#003670` · `#003260` · `#01264C` · `#012142` · `#011932`

### Reglas de uso del color

- Azules profundos para fondos y jerarquía; cianes vivos como acento sobre fondos oscuros (contraste y energía); azules claros para superficies suaves.
- Mantener siempre contraste accesible y texto legible (texto claro sobre azules oscuros; texto azul oscuro sobre superficies claras).

Variables CSS sugeridas para el prototipo:

```css
:root {
  --awk-bg-dark: #011932;
  --awk-bg: #01264C;
  --awk-surface: #003260;
  --awk-surface-light: #F0F3FC;
  --awk-border: #27334F;
  --awk-accent: #19F7F1;
  --awk-accent-strong: #0ABCC9;
  --awk-accent-deep: #0B93AA;
  --awk-text-on-dark: #F0F3FC;
  --awk-text-on-light: #01264C;
  --awk-muted: #72A3C4;
}
```

## Logotipos (PNG, fondo transparente)

Elegir la variante según el fondo del lienzo — usar SIEMPRE por URL (no base64):

| Variante | URL |
|---|---|
| Logo completo · fondo CLARO | `https://media.awakelab.world/MARCA_AWK26/awakelab_logo_fondo-blanco_transparente.png` |
| Logo completo · fondo OSCURO | `https://media.awakelab.world/MARCA_AWK26/awakelab_logo_fondo-oscuro_transparente.png` |
| Isotipo · fondo CLARO (favicon, marca de agua, espacios reducidos) | `https://media.awakelab.world/MARCA_AWK26/awakelab_isotipo_fondo-blanco_transparente.png` |
| Isotipo · fondo OSCURO | `https://media.awakelab.world/MARCA_AWK26/awakelab_isotipo_fondo-oscuro_transparente.png` |

Reglas: logo completo en cabeceras y portadas; isotipo solo para espacios reducidos. No recolorear, deformar ni rotar. Margen de protección equivalente a la altura del isotipo. Variante clara u oscura acorde al fondo.
