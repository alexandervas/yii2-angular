
// -------------------------------------------------------------
// Angular App
// -------------------------------------------------------------
var app = angular.module('App', [
    'ngRoute'
]);

// -------------------------------------------------------------
// Routes
// -------------------------------------------------------------
app.config(['$routeProvider', function($routeProvider) {

    $routeProvider.
        when('/about', {
            templateUrl: '/partials/about.html'
        }).
        when('/contact', {
            templateUrl: '/partials/contact.html'
        }).
        when('/register', {
            templateUrl: '/partials/register.html'
        }).
        when('/login', {
            templateUrl: '/partials/login.html'
        }).
        otherwise({
            templateUrl: '/partials/index.html'
        });
}]);

// -----------------------------------------------------------------
// Set up ajax requests and jwt processing
// -----------------------------------------------------------------
app.config(['$httpProvider', function($httpProvider) {

    // set up ajax requests
    // http://www.yiiframework.com/forum/index.php/topic/62721-yii2-and-angularjs-post/
    $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';

    // add jwt into http headers
    $httpProvider.interceptors.push(['$window', function($window) {
        return {
            request: function(config) {
                if ($window.localStorage.jwt) {
                    config.headers.Authorization = 'Bearer ' + $window.localStorage.jwt;
                }
                return config;
            }
        };
    }]);
}]);

app.run(['jwtRefresher', function(jwtRefresher) {
    jwtRefresher.start();
    jwtRefresher.refresh();
}]);

app.factory('jwtRefresher', ['$window', '$interval', 'Api', function($window, $interval, Api) {

    var factory = {};
    var refreshInterval;
    var refreshTime = 1000*60*4; // check every 4 minutes, as the jwt lasts for 5 minutes

    factory.refresh = function() {
        var jwtRefresh = $window.localStorage.jwtRefresh;
        if (jwtRefresh) {
            Api.post('public/jwt-refresh', {jwtRefresh: jwtRefresh}).then(function (data) {
                if (data.success) {
                    $window.localStorage.jwt = data.success.jwt;
                    $window.localStorage.jwtRefresh = data.success.jwtRefresh;
                }
            });
        }
    };

    factory.start = function() {
        refreshInterval = $interval(factory.refresh, refreshTime);
    };

    factory.stop = function() {
        $interval.cancel(refreshInterval);
    };

    return factory;
}]);

// -----------------------------------------------------------------
// Api factory
// -----------------------------------------------------------------
app.factory('Api', ['$http', '$q', '$window', '$location', function($http, $q, $window, $location) {

    var factory = {};
    var apiUrl = API_URL;

    // process ajax success/error calls
    var processAjaxSuccess = function(res) {
        return res.data;
    };
    var processAjaxError = function(res) {

        // process 401 by redirecting to login page
        // otherwise just alert the error
        if (res.status == 401) {
            $window.localStorage.loginUrl = $location.path();
            $location.path('/login').replace();
        } else {
            alert(error);
        }

        // calculate and return error msg
        var error = '[ ' + res.status + ' ] ' + (res.data.message || res.statusText);
        return $q.reject(error);
    };

    // define REST functions
    factory.get = function(url, data) {
        return $http.get(apiUrl + url, {params: data}).then(processAjaxSuccess, processAjaxError);
    };
    factory.post = function(url, data) {
        return $http.post(apiUrl + url, data).then(processAjaxSuccess, processAjaxError);
    };
    factory.put = function(url, data) {
        return $http.put(apiUrl + url, data).then(processAjaxSuccess, processAjaxError);
    };
    // http://stackoverflow.com/questions/26479123/angularjs-http-delete-breaks-on-ie8
    factory['delete'] = function(url) {
        return $http['delete'](apiUrl + url).then(processAjaxSuccess, processAjaxError);
    };

    // set up recaptcha
    var recaptchaDefer = $q.defer();
    factory.getRecaptcha = function() {
        return recaptchaDefer.promise;
    };
    $window.recaptchaLoaded = function() {
        recaptchaDefer.resolve($window.grecaptcha);
    };

    return factory;
}]);

// -----------------------------------------------------------------
// User factory
// -----------------------------------------------------------------
app.factory('User', ['Api', function(Api) {

    var factory = {};

    // get/store user
    // todo wait for refresh check
    var user;
    Api.get('public/user').then(function(data) {
        user = data.success;
    });

    factory.getAttributes = function() {
        return user ? user : null;
    };

    factory.getAttribute = function(attribute, defaultValue) {
        return user ? user[attribute] : defaultValue;
    };

    factory.isLoggedIn = function() {
        return user ? true : false;
    };

    factory.register = function(data) {
        return Api.post('public/register', data).then(function(data) {
            user = data.success;
            return data;
        });
    };

    factory.login = function(data) {
        return Api.post('public/login', data).then(function(data) {
            if (data.success) {
                user = data.success.user;
            }
            return data;
        });
    };

    factory.logout = function() {
        return Api.post('public/logout').then(function(data) {
            if (data.success) {
                user = null;
            }
            return data;
        });
    };

    return factory;
}]);

// -------------------------------------------------------------
// Nav controller
// -------------------------------------------------------------
app.controller('NavController', ['$scope', '$window', 'User', function($scope, $window, User) {

    $scope.User = User;

    $scope.logout = function() {
        User.logout().then(function(data) {
            $window.localStorage.jwt = '';
            $window.localStorage.jwtRefresh = '';
        });

    };
}]);

// -------------------------------------------------------------
// Contact controller
// -------------------------------------------------------------
app.controller('ContactController', ['$scope', 'Api', function($scope, Api) {

    $scope.errors = {};
    $scope.sitekey = RECAPTCHA_SITEKEY;
    $scope.ContactForm = {
        name: '',
        email: '',
        subject: '',
        body: '',
        captcha: ''
    };

    // set up and store grecaptcha data
    var recaptchaId;
    var grecaptchaObj;
    Api.getRecaptcha().then(function(grecaptcha) {
        grecaptchaObj = grecaptcha;
        if (RECAPTCHA_SITEKEY) {
            recaptchaId = grecaptcha.render("contact-captcha", {sitekey: $scope.sitekey});
        }
    });

    // process form submit
    $scope.submit = function() {

        // check captcha before making POST request
        if (RECAPTCHA_SITEKEY) {
            $scope.ContactForm.captcha = grecaptchaObj.getResponse(recaptchaId);
            if (!$scope.ContactForm.captcha) {
                $scope.errors.captcha = ['Invalid captcha'];
                return false;
            }
        }

        $scope.errors = {};
        $scope.submitting  = true;
        Api.post('public/contact', $scope.ContactForm).then(function(data) {
            $scope.submitting  = false;
            if (data.success) {
                $scope.errors = false;
            }
            else if (data.errors) {
                $scope.errors = data.errors;
            }
        });
    };
}]);

// -------------------------------------------------------------
// Login controller
// -------------------------------------------------------------
app.controller('LoginController', ['$scope', '$location', '$window', 'User', function($scope, $location, $window, User) {

    $scope.errors = {};
    $scope.LoginForm = {
        email: '',
        password: '',
        rememberMe: true
    };

    // get and update login url if set
    $scope.loginUrl = '';
    if ($window.localStorage.loginUrl) {
        $scope.loginUrl = $window.localStorage.loginUrl;
    }

    // process form submit
    $scope.submit = function() {
        $scope.errors = {};
        $scope.submitting  = true;
        User.login($scope.LoginForm).then(function(data) {
            $scope.submitting  = false;
            if (data.success) {
                // store jwt data and redirect to url
                $window.localStorage.jwt = data.success.jwt;
                $window.localStorage.jwtRefresh = data.success.jwtRefresh;
                $window.localStorage.loginUrl = '';
                $location.path($scope.loginUrl).replace();
            }
            else if (data.errors) {
                $scope.errors = data.errors;
            }
        });
    };
}]);

// -------------------------------------------------------------
// Register controller
// -------------------------------------------------------------
app.controller('RegisterController', ['$scope', '$location', 'User', 'Api', function($scope, $location, User, Api) {

    $scope.errors = {};
    $scope.sitekey = RECAPTCHA_SITEKEY;
    $scope.RegisterForm = {
        email: '',
        newPassword: '',
        captcha: ''
    };

    // set up and store grecaptcha data
    var recaptchaId;
    var grecaptchaObj;
    Api.getRecaptcha().then(function(grecaptcha) {
        grecaptchaObj = grecaptcha;
        if (RECAPTCHA_SITEKEY) {
            recaptchaId = grecaptcha.render("register-captcha", {sitekey: RECAPTCHA_SITEKEY});
        }
    });

    // process form submit
    $scope.submit = function() {

        // check captcha before making POST request
        if (RECAPTCHA_SITEKEY) {
            $scope.RegisterForm.captcha = grecaptchaObj.getResponse(recaptchaId);
            if (!$scope.RegisterForm.captcha) {
                $scope.errors.captcha = ['Invalid captcha'];
                return false;
            }
        }

        $scope.errors = {};
        $scope.submitting  = true;
        User.register($scope.RegisterForm).then(function(data) {
            $scope.submitting  = false;
            if (data.success) {
                $location.path('/');
            }
            else if (data.errors) {
                $scope.errors = data.errors;
            }
        });
    };
}]);