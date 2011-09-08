This is note-o-rama, a second attempt.

Website: [note-o-rama.com](http://note-o-rama.com)

How does it work?  A javascript bookmarklet allows users to annotate web pages (any web page), and to reload their notes on re-visiting them.  The notes are stored on a couchdb instance which serves up the notes in html organised by source, author or tag, and allows users to edit their notes as well.

Where to start?  The file server/nrama/lib/nrama2.js is the bookmarklet code (I realise this isn't an obvious place for it; it's there because it also serves as a library for the server part.)

The server part uses caolan's wonderful kanso (also on github).  
