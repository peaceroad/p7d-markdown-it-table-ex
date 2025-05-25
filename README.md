# p7d-markdown-it-table-ex

A markdown-it plugin. For table processing, this plugin plus some extended syntax.

- matrix (enabled by default.)
- wrapper (option.)

Notice. This is intended to be used in conjunction with [markdown-it-multimd-table](https://github.com/redbug312/markdown-it-multimd-table) enabled the option: headerless, multiline, rowspan.

## Use

```js
import mdit from 'markdown-it'
import mditMultimdTable from 'markdown-it-multimd-table'
import mditTableEx from '@peaceroad/markdown-it-table-ex'

const md = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx)
```

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

colgroup will be enabled as follows:

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

If you use grouped header notation in the table header (e.g., `**group:** hh1`), `<colgroup>` and a multi-row `<thead>` will be generated automatically.

- If there are two or more grouped header cells, the first row will output group names. If all group names are the same (e.g., `**group:**`), that name (e.g., `group`) is used. If there are different group names (e.g., `**foods:**`, `**drinks:**`), each group name is output as is.
- `<colgroup>` is inserted directly under `<table>` and before `<thead>`, and `<col span="N">` is output according to the number of columns in each group.
- If there are less than two grouped header cells, a normal single-row header is output and `<colgroup>` is not generated.
- Columns that are not grouped (such as the leftmost column) will have `rowspan="2"`.

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


[Markdown]
| | **group:** hh1  | **group:** hh2  | hh1  |  hh2  |
| --- | ---- | ---- | ---- | ---- |
| vh1 |  11  |  12  | 13  |  14  |
| vh2 |  21  |  22  | 23  |  24  |
[HTML]
<table>
<colgroup>
<col>
<col span="2">
<col>
<col>
</colgroup>
<thead>
<tr>
<th rowspan="2" scope="col"></th>
<th colspan="2" scope="col">group</th>
<th rowspan="2" scope="col">hh1</th>
<th rowspan="2" scope="col">hh2</th>
</tr>
<tr>
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

- If there is no grouped header notation or only one, a normal single-row header is output and no colgroup is generated.

