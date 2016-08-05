
import {getConfig} from './functions.js'
import store from './store.js'
import router from './router.js'

// --------------------------------------------------------
// Setup
// --------------------------------------------------------
$.ajaxSetup({
    xhrFields: { withCredentials: true } // needed for cross domain cookies
});

// --------------------------------------------------------
// VM helpers (for use in .vue components)
// --------------------------------------------------------
export function reset (vm) {
    vm.submitting = true;
    vm.success = null;
    vm.error = null;
    vm.errors = {};
}

export function process (vm, data) {
    vm.submitting = false;
    if (data.success) {
        vm.success = data.success;
    }
    if (data.error) {
        vm.error = data.error;
    }
    if (data.errors) {
        vm.errors = data.errors;
    }
}

// --------------------------------------------------------
// Ajax shortcuts
// --------------------------------------------------------
export function get (url, data) {
    return $.ajax({
        url: getConfig('apiUrl') + url,
        method: 'GET',
        data: data
    }).then(successCallback, failureCallback);
}

export function post (url, data) {
    return $.ajax({
        url: getConfig('apiUrl') + url,
        method: 'POST',
        data: data
    }).then(successCallback, failureCallback);
}

// --------------------------------------------------------
// Ajax callback helper functions
// --------------------------------------------------------
function successCallback(data) {
    return data;
}

function failureCallback(data) {

    // store original ajax request and build reject object
    // @link http://stackoverflow.com/questions/21509278/jquery-deferred-reject-immediately
    const origAjax = this
    const reject = $.Deferred().reject()

    // check for non-401 -> alert the error and reject
    if (data.status != 401) {
        alert(`${data.status} - ${data.statusText}\n\nURL - ${origAjax.url}`)
        return reject
    }

    // attempt to use refresh token
    // if successful, return the original ajax request
    // otherwise, reject
    const refreshTokenData = store.getters.refreshToken ? {_refreshToken: store.getters.refreshToken} : {}
    return $.ajax({
        url: getConfig('apiUrl') + 'auth/use-refresh-token',
        data: refreshTokenData
    }).then(function(data) {
        if (data.success) {
            return $.ajax(origAjax)
        }

        // set login url and redirect to login page
        store.commit('setLoginUrl', router.history.getLocation())
        router.push('/login')
        return reject
    });
}