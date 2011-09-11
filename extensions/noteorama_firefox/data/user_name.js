

self.port.on('init', function(msg){
  update(msg.username)
  console.log('init called');
});


function update(user/*optional*/){
  console.log('update, user='+user);
  if( user !== undefined && user !== null ) {
    self.port.emit('set_user', user);
  }
  if ( user ) {
    document.getElementById('see_my_notes').style.display = '';
    document.getElementById('see_my_notes').innerHTML = 'You can view your notes at: <br /><a href="http://note-o-rama.com/users/'+user+'" target="_blank">http://note-o-rama.com/users/'+user+'</a>';
    document.getElementById('nrama_user').value = user;
  } else {
    document.getElementById('see_my_notes').style.display = 'none';
  }

}

function on_blur(input) {
  var user = document.getElementById('nrama_user').value;
  update(user);
}
document.getElementById('nrama_user').addEventListener('blur', on_blur);