# ssb-repl

Explore json-stat datasets from Statistics Norway in a node repl

# Usage

Pass a SSB table id or path, then explore the data with the [JSON-stat API](https://json-stat.com/)


    $ ssb-repl al/al03/aku/SBMENU422/MidlAnsattAar

    > ds.Dataset(0).Dimension().map(e => e.label)
    [ 'kjønn', 'alder', 'statistikkvariabel', 'år' ]

    $ ssb-repl 07221

    > ds.Dataset(0).Dimension().map(e => e.label)
    [ 'region', 'boligtype', 'statistikkvariabel', 'kvartal' ]
