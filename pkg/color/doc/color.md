# Color
@qtxr/color is a library for parsing, transforming, and handling colors. It's fully compliant with the syntax described by [W3C's CSS Color Module Level 3](https://www.w3.org/TR/2018/REC-css-color-3-20180619/). It also adds support for CMYK colors with the same syntax. The syntax specified bt W3C is followed exactly, and any malformed color strings are rejected. By default a warning is logged when this happens. This can be toggled via `Color.suppressWarnings`.

## Color constructor
```ts
new Color(source: string | number[] | Color, space?: string, immutable?: boolean)
```

If `space` is defined, it will be set as the color space for the current color. This value describes how the color should be stringified by default. It loosely resembles the name of the color space, with the notable exception of `hex`, which still operates in RGB space. The actual color data is always stored in RGBA during the entire lifecycle of a Color instance, and other channels are computed on the fly at runtime.

If `immutable` is a boolean type, it's used as a flag and the mutability of the instance is set. This setting cannot be revoked after instantiation. Conversely, if no flag is provided, the instance is defined as mutable. The mutability setting can also be toggled at any time.

The Color constructor accepts the following color formats:

#### String
```ts
new Color("#abc")
```

```
== color keyword ==
red / blue / green

== hex ==
#aabbcc / #abc / #aabbccdd / #abcd

== RGB ==
rgb(1, 2, 3) / rgb(1%, 2%, 3%) / rgb(1 2 3) / rgb(1% 2% 3%)

== RGBA ==
rgb(1, 2, 3, 50%) / rgb(1%, 2%, 3%, 0.5) / rgb(1 2 3 / 0.5) / rgb(1% 2% 3% / 50%)

== HSL ==
hsl(180, 100%, 50%) / hsl(100(deg/rad/grad/turn), 100%, 50%) / hsl(0 100% 50%)

== HSLA ==
hsla(180, 100%, 50%, 0.5) / hsla(180, 100%, 50%, 50%) / hsla(100(deg/rad/grad/turn), 100%, 50%, 0.5) / hsla(180 100% 50% / 50%)

== CMYK ==
cmyk(1%, 2%, 3%, 4%) / cmyk(1% 2% 3% 4%)
```

#### Array
```ts
new Color([1, 2, 3])
```

```
[]			=> rgba(0, 0, 0, 1)
[10]			=> rgba(10, 0, 0, 1)
[10, 20, 30] 		=> rgba(10, 20, 30, 1)
[10, 20, 30, 0.5] 	=> rgba(10, 20, 30, 0.5)
```

#### Color
```ts
new Color(c)
```

Simply returns a new instance and deep copies the color data. Mutability settings are not transferred.

## Static Methods
`Color` defines number of static methods mainly centered around parsing and conversion:

### Parsing
The following methids parse color strings:

#### Color.parse

```ts
Color.parse(src: string | number[] | Color): Color
```

Constructs a new Color instance.

#### Color.parseRaw

```ts
Color.parseRaw(src: string | number[]): IColorData {
	space: string,
	rgba: number[],
	source: string | number[]
}
```

Parses a string representation of a CSS color, or RGBA array. Returns an object containing information about the color. This method caches parsed color strings for faster performance.

#### Color.parseHex

```ts
Color.parseHex(src: string): number[]
```

Parses a hex string (e.g. `#abc`, `#abcd`, `#abcdef`) and returns a clamped RGBA array. If no alpha channel is found, `1` (full opacity) is used instead. If string parsing fails, an empty RGBA array (all zeroes) is returned, and a warning is emitted.

#### Color.parseRGBA

```ts
Color.parseRGBA(src: string): number[]
```

Parses an RGBA string (e.g. `rgba(1, 2, 3, 0.5)`, `rgba(1 2 3 / 0.5)`) and returns a clamped RGBA array. If no alpha channel is found, `1` (full opacity) is used instead. If string parsing fails, an empty RGBA array (all zeroes) is returned, and a warning is emitted.

#### Color.parseRGB

```ts
Color.parseRGB(src: string): number[]
```

Alias for `Color.parseRGBA`, as per W3C spec `rgb` and `rgba` are interchangeable.

#### Color.parseHSLA

```ts
Color.parseHSLA(src: string): number[]
```

Parses an HSLA string (e.g. `hsla(0, 100%, 50%, 0.5)`, `hsla(0 100% 50% / 0.5)`) and returns a clamped RGBA array. If no alpha channel is found, `1` (full opacity) is used instead. If string parsing fails, an empty RGBA array (all zeroes) is returned, and a warning is emitted.

#### Color.parseHSL
HSLtoRGB

Alias for `Color.parseHSLA`, as per W3C spec `hsl` and `hsla` are interchangeable.

#### Color.parseCMYK

Parses a CMYK string (e.g. `cmyk(1%, 2%, 3%, 4%)`, `cmyk(1% 2% 3% 4%)`) and returns a clamped RGBA array. If no alpha channel is found, `1` (full opacity) is used instead. If string parsing fails, an empty RGBA array (all zeroes) is returned, and a warning is emitted.

### Color Space Conversion
The following methods convert between the supported color spaces:

#### Color.HSLtoRGB

```ts
Color.HSLtoRGB(hsl: number[]): number[]
```

Converts an HSL array to RGB. The alpha channel is ignored.

#### Color.HSLAtoRGBA

```ts
Color.HSLAtoRGBA(hsla: number[]): number[]
```

Converts an HSLA array to RGBA. The alpha channel is copied over or set to `1` (full opacity) if not provided.

#### Color.RGBtoHSL

```ts
Color.RGBtoHSL(rgb: number[]): number[]
```

Converts an RGB array to HSL. The alpha channel is ignored.

#### Color.RGBAtoHSLA

```ts
Color.RGBAtoHSLA(rgba: number[]): number[]
```

Converts an RGBA array to HSLA. The alpha channel is copied over or set to `1` (full opacity) if not provided.

#### Color.RGBtoCMYK

```ts
Color.RGBtoCMYK(rgb: number[]): number[]
```

Converts an RGB array to CMYK. The alpha channel is ignored, and as CMYK in general doesn't use alpha channels, there exists no `Color.RGBAtoCMYKA` method.

#### Color.CMYKtoRGB

```ts
Color.CMYKtoRGB(rgba: number[]): number[]
```

Converts a CMYK array to RGB. The alpha channel is set to `1` (full opacity).

### Utilities and Advanced Features
The following methods are used for utility or for advanced features:

#### Color.stringify

```ts
Color.stringify(src: Color | number[], space?: string = "rgba"): string
```

Stingifies a color or RGBA array to a CSS color string. By default, and for optimal performance, the returned value is an RGBA string. However, by specifying `space`, other formats can be retrieved. As of writing, these formats are `rgb, rgba, hsl, hsla, hex, cmyk, and auto`. If `auto` is specified, a lookup will also be made to check if the color matches a CSS color keyword, e.g.

```ts
Color.stringify(new Color("#f00"), "auto") // "red"
```

Otherwise, `auto` will return an RGB or RGBA string depending on the color's alpha channel.

This method is used interally by `Color.prototype.toString`.

#### Color.gradient

```ts
Color.gradient(...stops: string | [string, number]): Gradient
```

Constructs a new Gradient instance. See [Gradient section](#gradient) for more information.

#### Color.interpolate

```ts
Color.interpolate(gradient: Gradient, at: number): string
```

Interpolates a gradient at a position (0-1) and returns a color string.

#### Color.equals

```ts
Color.equals(src: Color | string | number[], src2: Color | string | number[]): boolean
```

Resolves and compares the RGBA values of the two color sources. Returns true if and only if the resolved values are strictly identical.

## Constants
`Color` defines constants for all 149 CSS color keywords as immutable `Color` instances. They can be accessed in lowercase and capitalized format.

| Name | Capitalized | Hex Code |
|-|-|-|
| `Color.aliceblue` | `Color.ALICEBLUE` | #f0f8ff |
| `Color.antiquewhite` | `Color.ANTIQUEWHITE` | #faebd7 |
| `Color.aqua` | `Color.AQUA` | #0ff |
| `Color.aquamarine` | `Color.AQUAMARINE` | #7fffd4 |
| `Color.azure` | `Color.AZURE` | #f0ffff |
| `Color.beige` | `Color.BEIGE` | #f5f5dc |
| `Color.bisque` | `Color.BISQUE` | #ffe4c4 |
| `Color.black` | `Color.BLACK` | #000 |
| `Color.blanchedalmond` | `Color.BLANCHEDALMOND` | #ffebcd |
| `Color.blue` | `Color.BLUE` | #00f |
| `Color.blueviolet` | `Color.BLUEVIOLET` | #8a2be2 |
| `Color.brown` | `Color.BROWN` | #a52a2a |
| `Color.burlywood` | `Color.BURLYWOOD` | #deb887 |
| `Color.cadetblue` | `Color.CADETBLUE` | #5f9ea0 |
| `Color.chartreuse` | `Color.CHARTREUSE` | #7fff00 |
| `Color.chocolate` | `Color.CHOCOLATE` | #d2691e |
| `Color.coral` | `Color.CORAL` | #ff7f50 |
| `Color.cornflowerblue` | `Color.CORNFLOWERBLUE` | #6495ed |
| `Color.cornsilk` | `Color.CORNSILK` | #fff8dc |
| `Color.crimson` | `Color.CRIMSON` | #dc143c |
| `Color.cyan` | `Color.CYAN` | #0ff |
| `Color.darkblue` | `Color.DARKBLUE` | #00008b |
| `Color.darkcyan` | `Color.DARKCYAN` | #008b8b |
| `Color.darkgoldenrod` | `Color.DARKGOLDENROD` | #b8860b |
| `Color.darkgray` | `Color.DARKGRAY` | #a9a9a9 |
| `Color.darkgreen` | `Color.DARKGREEN` | #006400 |
| `Color.darkgrey` | `Color.DARKGREY` | #a9a9a9 |
| `Color.darkkhaki` | `Color.DARKKHAKI` | #bdb76b |
| `Color.darkmagenta` | `Color.DARKMAGENTA` | #8b008b |
| `Color.darkolivegreen` | `Color.DARKOLIVEGREEN` | #556b2f |
| `Color.darkorange` | `Color.DARKORANGE` | #ff8c00 |
| `Color.darkorchid` | `Color.DARKORCHID` | #9932cc |
| `Color.darkred` | `Color.DARKRED` | #8b0000 |
| `Color.darksalmon` | `Color.DARKSALMON` | #e9967a |
| `Color.darkseagreen` | `Color.DARKSEAGREEN` | #8fbc8f |
| `Color.darkslateblue` | `Color.DARKSLATEBLUE` | #483d8b |
| `Color.darkslategray` | `Color.DARKSLATEGRAY` | #2f4f4f |
| `Color.darkslategrey` | `Color.DARKSLATEGREY` | #2f4f4f |
| `Color.darkturquoise` | `Color.DARKTURQUOISE` | #00ced1 |
| `Color.darkviolet` | `Color.DARKVIOLET` | #9400d3 |
| `Color.deeppink` | `Color.DEEPPINK` | #ff1493 |
| `Color.deepskyblue` | `Color.DEEPSKYBLUE` | #00bfff |
| `Color.dimgray` | `Color.DIMGRAY` | #696969 |
| `Color.dimgrey` | `Color.DIMGREY` | #696969 |
| `Color.dodgerblue` | `Color.DODGERBLUE` | #1e90ff |
| `Color.firebrick` | `Color.FIREBRICK` | #b22222 |
| `Color.floralwhite` | `Color.FLORALWHITE` | #fffaf0 |
| `Color.forestgreen` | `Color.FORESTGREEN` | #228b22 |
| `Color.fuchsia` | `Color.FUCHSIA` | #f0f |
| `Color.gainsboro` | `Color.GAINSBORO` | #dcdcdc |
| `Color.ghostwhite` | `Color.GHOSTWHITE` | #f8f8ff |
| `Color.gold` | `Color.GOLD` | #ffd700 |
| `Color.goldenrod` | `Color.GOLDENROD` | #daa520 |
| `Color.gray` | `Color.GRAY` | #808080 |
| `Color.green` | `Color.GREEN` | #008000 |
| `Color.greenyellow` | `Color.GREENYELLOW` | #adff2f |
| `Color.grey` | `Color.GREY` | #808080 |
| `Color.honeydew` | `Color.HONEYDEW` | #f0fff0 |
| `Color.hotpink` | `Color.HOTPINK` | #ff69b4 |
| `Color.indianred` | `Color.INDIANRED` | #cd5c5c |
| `Color.indigo` | `Color.INDIGO` | #4b0082 |
| `Color.ivory` | `Color.IVORY` | #fffff0 |
| `Color.khaki` | `Color.KHAKI` | #f0e68c |
| `Color.lavender` | `Color.LAVENDER` | #e6e6fa |
| `Color.lavenderblush` | `Color.LAVENDERBLUSH` | #fff0f5 |
| `Color.lawngreen` | `Color.LAWNGREEN` | #7cfc00 |
| `Color.lemonchiffon` | `Color.LEMONCHIFFON` | #fffacd |
| `Color.lightblue` | `Color.LIGHTBLUE` | #add8e6 |
| `Color.lightcoral` | `Color.LIGHTCORAL` | #f08080 |
| `Color.lightcyan` | `Color.LIGHTCYAN` | #e0ffff |
| `Color.lightgoldenrodyellow` | `Color.LIGHTGOLDENRODYELLOW` | #fafad2 |
| `Color.lightgray` | `Color.LIGHTGRAY` | #d3d3d3 |
| `Color.lightgreen` | `Color.LIGHTGREEN` | #90ee90 |
| `Color.lightgrey` | `Color.LIGHTGREY` | #d3d3d3 |
| `Color.lightpink` | `Color.LIGHTPINK` | #ffb6c1 |
| `Color.lightsalmon` | `Color.LIGHTSALMON` | #ffa07a |
| `Color.lightseagreen` | `Color.LIGHTSEAGREEN` | #20b2aa |
| `Color.lightskyblue` | `Color.LIGHTSKYBLUE` | #87cefa |
| `Color.lightslategray` | `Color.LIGHTSLATEGRAY` | #789 |
| `Color.lightslategrey` | `Color.LIGHTSLATEGREY` | #789 |
| `Color.lightsteelblue` | `Color.LIGHTSTEELBLUE` | #b0c4de |
| `Color.lightyellow` | `Color.LIGHTYELLOW` | #ffffe0 |
| `Color.lime` | `Color.LIME` | #0f0 |
| `Color.limegreen` | `Color.LIMEGREEN` | #32cd32 |
| `Color.linen` | `Color.LINEN` | #faf0e6 |
| `Color.magenta` | `Color.MAGENTA` | #f0f |
| `Color.maroon` | `Color.MAROON` | #800000 |
| `Color.mediumaquamarine` | `Color.MEDIUMAQUAMARINE` | #66cdaa |
| `Color.mediumblue` | `Color.MEDIUMBLUE` | #0000cd |
| `Color.mediumorchid` | `Color.MEDIUMORCHID` | #ba55d3 |
| `Color.mediumpurple` | `Color.MEDIUMPURPLE` | #9370db |
| `Color.mediumseagreen` | `Color.MEDIUMSEAGREEN` | #3cb371 |
| `Color.mediumslateblue` | `Color.MEDIUMSLATEBLUE` | #7b68ee |
| `Color.mediumspringgreen` | `Color.MEDIUMSPRINGGREEN` | #00fa9a |
| `Color.mediumturquoise` | `Color.MEDIUMTURQUOISE` | #48d1cc |
| `Color.mediumvioletred` | `Color.MEDIUMVIOLETRED` | #c71585 |
| `Color.midnightblue` | `Color.MIDNIGHTBLUE` | #191970 |
| `Color.mintcream` | `Color.MINTCREAM` | #f5fffa |
| `Color.mistyrose` | `Color.MISTYROSE` | #ffe4e1 |
| `Color.moccasin` | `Color.MOCCASIN` | #ffe4b5 |
| `Color.navajowhite` | `Color.NAVAJOWHITE` | #ffdead |
| `Color.navy` | `Color.NAVY` | #000080 |
| `Color.oldlace` | `Color.OLDLACE` | #fdf5e6 |
| `Color.olive` | `Color.OLIVE` | #808000 |
| `Color.olivedrab` | `Color.OLIVEDRAB` | #6b8e23 |
| `Color.orange` | `Color.ORANGE` | #ffa500 |
| `Color.orangered` | `Color.ORANGERED` | #ff4500 |
| `Color.orchid` | `Color.ORCHID` | #da70d6 |
| `Color.palegoldenrod` | `Color.PALEGOLDENROD` | #eee8aa |
| `Color.palegreen` | `Color.PALEGREEN` | #98fb98 |
| `Color.paleturquoise` | `Color.PALETURQUOISE` | #afeeee |
| `Color.palevioletred` | `Color.PALEVIOLETRED` | #db7093 |
| `Color.papayawhip` | `Color.PAPAYAWHIP` | #ffefd5 |
| `Color.peachpuff` | `Color.PEACHPUFF` | #ffdab9 |
| `Color.peru` | `Color.PERU` | #cd853f |
| `Color.pink` | `Color.PINK` | #ffc0cb |
| `Color.plum` | `Color.PLUM` | #dda0dd |
| `Color.powderblue` | `Color.POWDERBLUE` | #b0e0e6 |
| `Color.purple` | `Color.PURPLE` | #800080 |
| `Color.rebeccapurple` | `Color.REBECCAPURPLE` | #639 |
| `Color.red` | `Color.RED` | #f00 |
| `Color.rosybrown` | `Color.ROSYBROWN` | #bc8f8f |
| `Color.royalblue` | `Color.ROYALBLUE` | #4169e1 |
| `Color.saddlebrown` | `Color.SADDLEBROWN` | #8b4513 |
| `Color.salmon` | `Color.SALMON` | #fa8072 |
| `Color.sandybrown` | `Color.SANDYBROWN` | #f4a460 |
| `Color.seagreen` | `Color.SEAGREEN` | #2e8b57 |
| `Color.seashell` | `Color.SEASHELL` | #fff5ee |
| `Color.sienna` | `Color.SIENNA` | #a0522d |
| `Color.silver` | `Color.SILVER` | #c0c0c0 |
| `Color.skyblue` | `Color.SKYBLUE` | #87ceeb |
| `Color.slateblue` | `Color.SLATEBLUE` | #6a5acd |
| `Color.slategray` | `Color.SLATEGRAY` | #708090 |
| `Color.slategrey` | `Color.SLATEGREY` | #708090 |
| `Color.snow` | `Color.SNOW` | #fffafa |
| `Color.springgreen` | `Color.SPRINGGREEN` | #00ff7f |
| `Color.steelblue` | `Color.STEELBLUE` | #4682b4 |
| `Color.tan` | `Color.TAN` | #d2b48c |
| `Color.teal` | `Color.TEAL` | #008080 |
| `Color.thistle` | `Color.THISTLE` | #d8bfd8 |
| `Color.tomato` | `Color.TOMATO` | #ff6347 |
| `Color.transparent` | `Color.TRANSPARENT` | #0000 |
| `Color.turquoise` | `Color.TURQUOISE` | #40e0d0 |
| `Color.violet` | `Color.VIOLET` | #ee82ee |
| `Color.wheat` | `Color.WHEAT` | #f5deb3 |
| `Color.white` | `Color.WHITE` | #fff |
| `Color.whitesmoke` | `Color.WHITESMOKE` | #f5f5f5 |
| `Color.yellow` | `Color.YELLOW` | #ff0 |
| `Color.yellowgreen` | `Color.YELLOWGREEN` | #9acd32 |

## Instance Methods
`Color` defines number of instance methods:

### Export
The following are export methods:

#### Color.prototype.clone

```ts
c.clone(immutable: boolean): Color
```

Creates a new instance based on the current color data. Mutability settings are not cloned by default, but the `immutable` flag will set this explicitly.

#### Color.prototype.toString

```ts
c.toString(space: string = c.space): string
```

Creates a color string representation of the color. Optionally, provide a color space string. By default, the color's color space is used. This method uses [Color.stringify](#colorstringify) under the hood.

#### Color.prototype.str

```ts
c.str(space: string = c.space): string
```

Alias for `Color.prototype.equals`.

#### Color.prototype.equals

```ts
c.equals(src: Color | string | number[]): boolean
```

Resolves and compares the RGBA values of the two color sources. Returns true if and only if the resolved values are strictly identical. Uses `Color.equals` under the hood.

### Immutable Transforms
The following methods will yield new `Color` instances via transforms:

#### Color.prototype.transform

```ts
c.transform(transforms: { [channel]: string | number | [string, number] } | string[] | string, operation?: string = "set"): Color
```

Applies free transforms to any [applicable channels](#channels) with operations. This method is the basis for most other transform methods.

The operations are as follows:

| Operation | Aliases |
|-|-|
| `add` | `plus`, `+`, `+=` |
| `subtract` | `sub`, `minus`, `-`, `-=` |
| `multiply` | `mul`, `times`, `*`, `*=` |
| `divide` | `div`, `over`, `/`, `/=` |
| `set` (default) | `equals`, `=` |

This method consumes transforms in a number of ways. The most basic way applies transforms using a simple object and a master operation:

```ts
// Add 10, 20, and 30 to each of the RGB channels
c.transform({
	r: 10,
	g: 20,
	b: 30
}, "add")
```

It's also possible to apply transforms with operation hinting:

```ts
// Add 10 to the R, subtract 20 from G, and set B to 30 via the master operation
c.transform({
	// Prefix operation
	"add@r": 10,
	// Explicit operation
	g: ["subtract", 20],
	// Inherit operation
	b: 30
}, "set")
```

There are aliases for both channels and operations:

```ts
// Add 10 to the R, subtract 20 from G, and set B to 30. The master operation, multiply, is not used
c.transform({
	"add@red": 10,
	green: ["minus", 20],
	blue: ["=", 30]
}, "mul")
```

Transforms may also be string arrays. The strings encode a channel, operation, and value:

```ts
// Add 10 to the R, subtract 20 from G, and set B to 30
c.transform([
	"red += 10",
	"g - 20",
	"blue equals 30"
])
```

For single channel transforms, it's also possible to provide a single string as the transform:

```ts
// Set the hue component to 0, signifying red 
c.transform("hue = 0")
```

#### Color.prototype.t

```ts
c.t(...transforms: { [channel]: string | number | [string, number] } | string[] | string): Color
```

Identical to `Color.prototype.transform`, but passes its arguments as transforms to the main transform function. Master operations are not supported.

#### Color.prototype.rotate

```ts
c.rotate(amount: number | string, unit?: string, op?: string = "add"): Color
```

Rotates the hue component by a set amount. This method accepts unit-value arguments:

```ts
// Degrees are the default unit
c.rotate(180)
c.rotate(180, "deg")
c.rotate(3.14, "rad")
c.rotate(42, "grad")
c.rotate(0.5, "turn")
```

Or compound arguments:

```ts
c.rotate("180deg")
c.rotate("3.14rad")
c.rotate("42grad")
c.rotate("0.5turn")
```

The `op` parameter is fed into `Color.prototype.transform` as the master operator. By default, rotation is additional, but any transform operator may be applied here:

```ts
c.rotate(180, "deg", "subtract")
c.rotate(2, "deg", "multiply")
```

#### Color.prototype.saturate

```ts
c.saturate(value: number | string, unit?: string, op?: string = "add"): Color
```

Saturates the color by modifying the saturation channel. This operation is fundamentally additive.

The `op` parameter is fed into `Color.prototype.transform` as the master operator.

#### Color.prototype.desaturate

```ts
c.desaturate(value: number | string, unit?: string, op?: string = "add"): Color
```

Desaturates the color by modifying the saturation channel. This operation is fundamentally subtractive.

The `op` parameter is fed into `Color.prototype.transform` as the master operator.

#### Color.prototype.lighten

```ts
c.lighten(value: number | string, unit?: string, op?: string = "add"): Color
```

Lightens the color by modifying the lightness channel. This operation is fundamentally additive.

The `op` parameter is fed into `Color.prototype.transform` as the master operator.

#### Color.prototype.darken

```ts
c.darken(value: number | string, unit?: string, op?: string = "add"): Color
```

Darkens the color by modifying the lightness channel. This operation is fundamentally subtractive.

The `op` parameter is fed into `Color.prototype.transform` as the master operator.

#### Color.prototype.opacify

```ts
c.opacify(value: number | string, unit?: string, op?: string = "add"): Color
```

Adjusts the color's opacity by modifying the alpha channel. This operation is fundamentally additive.

The `op` parameter is fed into `Color.prototype.transform` as the master operator.

#### Color.prototype.transparentize

```ts
c.transparentize(value: number | string, unit?: string, op?: string = "add"): Color
```

Adjusts the color's transparency by modifying the alpha channel. This operation is fundamentally subtractive.

The `op` parameter is fed into `Color.prototype.transform` as the master operator.

#### Color.prototype.interpolate

```ts
c.interpolate(src: Color | string | number[], weight: number = 0.5): Color
```

Applies linear interpolation to the color based on RGBA values. This method is the basis for `Color.prototype.mix` and `Color.prototype.invert`.

`src` may be a `Color` instance, color string, or RGBA array.

`weight` defines interpolation position. The default of `0.5` defines a 50/50 iterpolation between inputs.

#### Color.prototype.mix

```ts
c.mix(src: Color | string | number[], weight: number = 1): Color
```

Mixes the color and a reference color. The `weight` (`0` for no mixing, `1` for even mixing) is unbounded and exactly half the value internally fed into `Color.prototype.interpolate`.

#### Color.prototype.invert

```ts
c.invert(weight: number = 1): Color
```

Inverts the color. The `weight` (`0` for no inversion, `1` for full inversion) is unbounded and exactly half the value internally fed into `Color.prototype.interpolate`.

## Getters and Setters
All `Color` instances will come with a number of convenient getters and/or setters. Setters, when available, always mutate the target instance. Therefore, if an instance has `immutable` set to `true`, these setters will NOOP and emit a warning.

### get Color.prototype.luminance

```ts
c.luminance: number
```

Calculates the luminance of the current color, from 0 (relative black) to 1 (relative white).

### get Color.prototype.isDark

```ts
c.isDark: boolean
```

Determines whether the current color is dark (luminance < 0.5).

### get Color.prototype.isLight

```ts
c.isLight: boolean
```

Determines whether the current color is light (luminance >= 0.5).

### get Color.prototype.complement

```ts
c.complement: Color
```

Calculates the complement color of the current color, defined as the color directly opposite on the color wheel, i.e. its hue is rotated by 180 degrees. The returned value is a new instance of Color.

### get Color.prototype.grayscale

```ts
c.grayscale: Color
```

Calculates the grayscale equivalent of the current color, defined as the color's saturation channel set to 0. The returned value is a new instance of Color.


### Swizzling
"Swizzling" convenience getters/setters for various array representations of color data. The getters always return a fresh array with no reference to the internal color data. Their getters always have a corresponding setter, and assigning array data to these has the same effect as parsing the corresponding string representation:

```ts
c.hsl = [12, 100, 50]
c2 = new Color("hsl(12, 100%, 50%)")
c.equals(c2) // true
```

Additionally, these setters will also modify the color space field of the color.

These are the currntly supported swizzled properties:

| Swizzle | Example Output | Equivalent |
|-|-|-|
| `rgba` | [1, 2, 3, 0.5] | `rgba(1, 2, 3, 0.5)` |
| `rgb` | [1, 2, 3] | `rgb(1, 2, 3)` |
| `hsla` | [180, 100, 50, 0.5] | `hsla(180deg, 100%, 50%, 0.5)` |
| `hsl` | [180, 100, 50] | `hsl(180deg, 100%, 50%)` |
| `cmyk` | [1, 2, 3, 4] | `cmyk(1%, 2%, 3%, 4%)` |


### Channels
Channel getters/setters for accessing/setting individual channel values. Values, which must be numerical, are automatically clamped/modulated. Supplying invalid data emits an error and the corresponding value is zeroed.

| Channel | Alias | Description |
|-|-|-|
| `r` | `red` | Red channel (RGB) |
| `g` | `green` | Green channel (RGB) |
| `b` | `blue` | Blue channel (RGB) |
| `h` | `hue` | Hue channel (HSL) |
| `s` | `saturation` | Saturation channel (HSL) |
| `l` | `lightness` | Lightness channel (HSL) |
| `c` | `cyan` | Cyan channel (CMYK) |
| `m` | `magenta` | Magenta channel (CMYK) |
| `y` | `yellow` | Yellow channel (CMYK) |
| `k` | `key` | Key (black) channel (CMYK) |
| `a` | `alpha` | Alpha (opacity) channel (RGBA/HSLA) |

# Gradient
`Gradients` are representations of color stops, which can be linearly interpolated.

## Gradient constructor

```ts
new Gradient(...stops: string | [string, number])
```

Constructs a new `Gradient` from a number of color stops. The constructor invokes `Gradient.prototype.addStop` under the hood to parse stops.

#### Gradient.prototype.addStop

```ts
g.addStop(stop: string | [string, number]): Gradient
```

Adds a new stop to the current gradient. Stops can be added in two ways; the first being using strings:

```ts
g.addStop("red")
```

Alternatively, many stops may be added at the same time:

```ts
// These are interchangeable
g.addStop("red, blue")
g.addStop("#f00 0%, blue 100%")
```

String stop positions range from `0` to `100`.

The second way uses key-value arrays:

```ts
g.addStop(["red", 0])
g.addStop(["blue", 1])
```

This adds a `red` stop to position `0` and then `blue` to position `1`. Key-value color stops range from `0` to `1`.

#### Gradient.prototype.interpolate

```ts
g.interpolate(at: number, space?: string = "rgba"): string
```

Interpolates the gradient at position `at`. `at` ranges from `0` to `1`. Returns a string representation of the interpolated color. Optionally, `space` can be supplied to specify how colors are stringified (Using `Color.stringify`).

Colors are interpolated based on the closest color stop(s):

```ts
g = new Gradient("rgb(200, 0, 0) 20%, rgb(0, 200, 0), rgb(0, 0, 200) 80%")

g.interpolate(-10)	// rgba(200, 0, 0)
g.interpolate(0)	// rgba(200, 0, 0)
g.interpolate(0.19)	// rgba(200, 0, 0)
g.interpolate(0.35)	// rgba(100, 100, 0)
g.interpolate(0.5)	// rgba(0, 200, 0)
g.interpolate(0.65)	// rgba(0, 100, 100)
g.interpolate(0.81)	// rgba(0, 0, 200)
g.interpolate(1)	// rgba(0, 0, 200)
g.interpolate(10)	// rgba(0, 0, 200)
```
