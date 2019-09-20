# Color

@qtxr/color is a library for parsing, transforming, and handling colors. It's fully compliant with the syntax described by [W3C's CSS Color Module Level 3](https://www.w3.org/TR/2018/REC-css-color-3-20180619/). It also adds support for CMYK colors. It's designed to follow this syntax exactly, and will reject any malformed color strings.

### Color constructor `(source: string|number[]|Color, space?: string)`
If `space` is defined, it will be set as the color space for the current color. This value describes how the color should be stringified by default. The actual color data remains unchanged.

The Color constructor accepts the following color formats:

**String**
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

**Array**
```
[]			=> rgba(0, 0, 0, 1)
[10]			=> rgba(10, 0, 0, 1)
[10, 20, 30] 		=> rgba(10, 20, 30, 1)
[10, 20, 40, 0.5] 	=> rgba(10, 20, 0, 1)
```

**Color**

Simply returns a new instance and deep copies over the color data.
