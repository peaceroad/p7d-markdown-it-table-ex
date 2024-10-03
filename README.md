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
