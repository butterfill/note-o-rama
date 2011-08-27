/**
 * adapted by Stephen A. Butterfill
 * see http://stackoverflow.com/questions/1134976/how-may-i-sort-a-list-alphabetically-using-jquery
 */
(function($) {

    $.fn.sortlist = function(options) {
        this.filter('ul,ol').each(function() {
            var $list = $(this);
            var $items = $list.children('li')
            var items = $items.get();  //plain array
            items.sort( function(a,b) {
                var compA = $.trim($(a).text().toUpperCase());
                var compB = $.trim($(b).text().toUpperCase());
                return (compA < compB) ? -1 : (compA > compB) ? 1 : 0;
            });
            $.each(items, function(idx, item) {
                //var $item = $(item);
                //$item.hide(200, function(){ $list.append($item); $item.show(200); });
                $list.append(item);
            });
        });
        return this;
    }
})(jQuery);