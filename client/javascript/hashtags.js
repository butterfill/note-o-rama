  hashtag_regex = /(^|[^0-9A-Z&\/\?]+)(#|＃)([0-9A-Z_]*[A-Z_]+[a-z0-9_]*)/gi;
  get_tags = function(note) {
    if (!note.content) {
      return [];
    }
    var tags = [];
    note.content.replace(hashtag_regex, function(match, before, hash, hashText) {
      tags.push(hashText);  
    });
    return tags;
  };

