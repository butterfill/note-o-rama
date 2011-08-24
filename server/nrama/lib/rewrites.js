/**
 * Rewrite settings to be exported from the design doc
 */

module.exports = [
    {from: '/static/*', to: 'static/*'},
    {
        from: '/all_users',
        to: '_list/all_users/all_user_ids',
        method : 'GET',
        'query' : { 'group' : true }
    },
    //{from: '/', to: '_show/welcome'},
    //{from: '*', to: '_show/not_found'}
];
