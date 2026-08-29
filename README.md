# p7d-markdown-it-table-ex

A markdown-it plugin. For table processing, this plugin plus some extended syntax.

- matrix (enabled by default.)
- wrapper (option.)
- colgroup (option.)

Use this plugin together with
[`@peaceroad/markdown-it-multimd-table`](https://www.npmjs.com/package/%40peaceroad%2Fmarkdown-it-multimd-table),
configured with the options `headerless`, `multiline`, and `rowspan`.

## Use

```js
import mdit from 'markdown-it'
import mditMultimdTable from '@peaceroad/markdown-it-multimd-table'
import mditTableEx from '@peaceroad/markdown-it-table-ex'

const md = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx)
```

## StrongJa detection

When `@peaceroad/markdown-it-strong-ja` is registered, this plugin detects `**` markers by checking the inline rule named `strong_ja` and relies on inline tokens. If that rule is not present, it falls back to simple `**` string checks so matrix/colgroup still work without strongJa.

Install this plugin only once per `markdown-it` instance; create a separate instance if you need a different option set.

## Extended notation

### matrix

If the leftmost cell of the table is surrounded by `**`, it will be converted to a th element. Note that the first cell of thead can be empty.

```
[Markdown]
|         | hh1  | hh2  |
| ------- | ---- | ---- |
| **vh1** |  11  |  12  |
| **vh2** |  21  |  22  |
[HTML]
<table>
<thead>
<tr>
<th scope="col"></th>
<th scope="col">hh1</th>
<th scope="col">hh2</th>
</tr>
</thead>
<tbody>
<tr>
<th scope="row">vh1</th>
<td>11</td>
<td>12</td>
</tr>
<tr>
<th scope="row">vh2</th>
<td>21</td>
<td>22</td>
</tr>
</tbody>
</table>

[Markdown]
| **hh0** | hh1  | hh2  |
| ------- | ---- | ---- |
| **vh1** |  11  |  12  |
| **vh2** |  21  |  22  |
[HTML]
<table>
<thead>
<tr>
<th scope="col">hh0</th>
<th scope="col">hh1</th>
<th scope="col">hh2</th>
</tr>
</thead>
<tbody>
<tr>
<th scope="row">vh1</th>
<td>11</td>
<td>12</td>
</tr>
<tr>
<th scope="row">vh2</th>
<td>21</td>
<td>22</td>
</tr>
</tbody>
</table>
```

### wrapper

wrapper will be enabled as follows:

```js
const md = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, {
    wrapper: true,
  })
```

The table is wrapped in a div.table-wrapper element.
I think this is useful for moving the table left and right when the screen width is narrow.

```
[Markdown]
| hh0 | hh1  | hh2  |
| --- | ---- | ---- |
| vh1 |  11  |  12  |
| vh2 |  21  |  22  |
[HTML]
<div class="table-wrapper">
<table>
<thead>
<tr>
<th scope="col">hh0</th>
<th scope="col">hh1</th>
<th scope="col">hh2</th>
</tr>
</thead>
<tbody>
<tr>
<td>vh1</td>
<td>11</td>
<td>12</td>
</tr>
<tr>
<td>vh2</td>
<td>21</td>
<td>22</td>
</tr>
</tbody>
</table>
</div>
```

## colgroup

colgroup will be enabled as follows:

```js
const md = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, {
    colgroup: true,
  })
```

If you use grouped header notation in the table header (e.g., `**group:** hh1`), a `<thead>` with two tr lines will be generated. A `<colgroup>` is generated when at least one adjacent group spans multiple columns. If there is no grouped header notation or only one, a normal single-row header is output and no colgroup is generated.

In other words, to determine the group, if there is `**` at the beginning of a cell followed by `:**` (`：**`), it becomes a candidate, and is determined by matching it with the adjacent cells.

**Examples**:

```
[Markdown]
| hh0 | **group:** hh1  | **group:** hh2  | **group2:** hh1  | **group2:** hh2  |
| --- | ---- | ---- | ---- | ---- |
| vh1 |  11  |  12  | 13  |  14  |
| vh2 |  21  |  22  | 23  |  24  |
[HTML]
<table>
<colgroup>
<col>
<col span="2">
<col span="2">
</colgroup>
<thead>
<tr>
<th rowspan="2" scope="col">hh0</th>
<th colspan="2" scope="col">group</th>
<th colspan="2" scope="col">group2</th>
</tr>
<tr>
<th scope="col">hh1</th>
<th scope="col">hh2</th>
<th scope="col">hh1</th>
<th scope="col">hh2</th>
</tr>
</thead>
<tbody>
<tr>
<td>vh1</td>
<td>11</td>
<td>12</td>
<td>13</td>
<td>14</td>
</tr>
<tr>
<td>vh2</td>
<td>21</td>
<td>22</td>
<td>23</td>
<td>24</td>
</tr>
</tbody>
</table>
```

### colgroup with no asterisk

Do you find it troublesome to write `**`? You can omit it by adding more options.

```js
const md = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, {
    colgroup: true,
    colgroupWithNoAsterisk: true,
  })
```

In this case, if you use a half-width `:`, you need to follow it with one or more half-width spaces. If you use a full-width `:`, you don't need to follow it with a space.

```
[Markdown]
| hh0 | foods: hh1  | foods: hh2  | drinks: hh1  | drinks: hh2  |
| --- | ---- | ---- | ---- | ---- |
| vh1 |  11  |  12  | 13  |  14  |
| vh2 |  21  |  22  | 23  |  24  |
[HTML]
<table>
<colgroup>
<col>
<col span="2">
<col span="2">
</colgroup>
<thead>
<tr>
<th rowspan="2" scope="col">hh0</th>
<th colspan="2" scope="col">foods</th>
<th colspan="2" scope="col">drinks</th>
</tr>
<tr>
<th scope="col">hh1</th>
<th scope="col">hh2</th>
<th scope="col">hh1</th>
<th scope="col">hh2</th>
</tr>
</thead>
<tbody>
<tr>
<td>vh1</td>
<td>11</td>
<td>12</td>
<td>13</td>
<td>14</td>
</tr>
<tr>
<td>vh2</td>
<td>21</td>
<td>22</td>
<td>23</td>
<td>24</td>
</tr>
</tbody>
</table>
```
