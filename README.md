Note-o-rama
===========

***/server is still current; for /client and the browser extensions, see nrama3***

Add notes and highlights to documents without breaking the flow of your 
reading.
 
Website: [note-o-rama.com](http://note-o-rama.com)

How does it work?  A javascript bookmarklet allows users to annotate web 
pages (any web pages), and to reload their notes on re-visiting them.  
The notes are stored in a couchdb database which serves up the notes as 
html documents organised by source, author or tag, and allows users to 
edit their notes as well.

Where to start?  The file server/nrama/lib/nrama2.js is the bookmarklet 
code. (I realise this isn't an obvious place for it; it's there because 
nrama2.js doubles as a library for the server part. (That's part of the 
appeal of couchdb for this project: chunks of the bookmarklet code also 
work on the server.))

The server part uses caolan's wonderful 
[kanso](https://github.com/caolan/kanso).

(In case you saw the earlier incarnation of Note-o-rama (2007-2011), 
this is a second attempt and completely re-written. It works in much the 
same way except that it doesn't depend on Firefox internals and very 
much less code is involved as there are some terrific libraries which 
take care of the hard parts.)
