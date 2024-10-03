# p7d-markdown-it-table

A markdown-it plugin. For table processing, this plugin import [markdown-it-multimd-table](https://github.com/redbug312/markdown-it-multimd-table) and use its syntax, plus some extended syntax.

Enabled by default
:   - rowspan (multimd-table)
    - headerless (multimd-table)
    - matrix

Option
:   - multiline (multimd-table)
    - wrapper

## extended syntax

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
```

### wrapper

The table is wrapped in a div.table-wrapper element.
I think this is useful for moving the table left and right when the screen width is narrow.

```
[Markdown]
| **hh0** | hh1  | hh2  |
| ------- | ---- | ---- |
| **vh1** |  11  |  12  |
| **vh2** |  21  |  22  |

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
</div>
```
