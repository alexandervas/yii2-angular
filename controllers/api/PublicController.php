<?php

namespace app\controllers\api;

use Yii;
use yii\filters\VerbFilter;

class PublicController extends BaseController
{
    /**
     * @var \app\components\JwtAuth
     */
    public $jwtAuth;

    /**
     * @var string
     */
    public $loginFormClass = "app\\models\\forms\\LoginForm";

    /**
     * @var string
     */
    public $contactFormClass = "app\\models\\forms\\ContactForm";

    /**
     * @inheritdoc
     */
    public function init()
    {
        if (!$this->jwtAuth) {
            $this->jwtAuth = Yii::$app->jwtAuth;
        }
    }
    
    /**
     * @inheritdoc
     */

    public function behaviors()
    {
        $behaviors = parent::behaviors();
        unset($behaviors["jwtAuth"]);
        return $behaviors;
    }

    /**
     * Contact
     */
    public function actionContact()
    {
        /** @var \app\models\forms\ContactForm $model */
        $model = Yii::createObject($this->contactFormClass);
        $toEmail = Yii::$app->params["adminEmail"];
        $model->load(Yii::$app->request->post(), "");
        if ($model->contact($toEmail)) {
            return ["success" => true];
        }
        return ["errors" => $model->errors];
    }

    /**
     * Login
     */
    public function actionLogin()
    {
        /** @var \app\models\forms\LoginForm $model */
        // notice that we set the second parameter $formName = ""
        $request = Yii::$app->request;
        $model = Yii::createObject($this->loginFormClass);
        $model->load($request->post(), "");
        if ($model->validate()) {
            $userAttributes = $model->getUser()->toArray();
            $rememberMe = $request->post("rememberMe", true);
            $jwtCookie = $request->post("jwtCookie", true);
            $authJwtData = $this->generateAuthOutput($userAttributes, $rememberMe, $jwtCookie);
            return ["success" => $authJwtData];
        }
        return ["errors" => $model->errors];
    }

    /**
     * Logout
     */
    public function actionLogout()
    {
        $jwtAuth = $this->jwtAuth;
        $jwtAuth->removeCookieToken();
        $jwtAuth->removeRefreshCookieToken();
        return ["success" => true];
    }

    /**
     * Register
     */
    public function actionRegister()
    {
        /** @var \app\models\User $user */

        // attempt to register user
        $request = Yii::$app->request;
        $user = Yii::$app->user->identityClass;
        $user = $user::register($request->post());

        if (!is_array($user)) {
            $userAttributes = $user->toArray();
            $rememberMe = $request->post("rememberMe", true);
            $jwtCookie = $request->post("jwtCookie", true);
            return ["success" => $this->generateAuthOutput($userAttributes, $rememberMe, $jwtCookie)];
        }
        return ["errors" => $user];
    }

    /**
     * Renew token
     */
    public function actionRenewToken()
    {
        // attempt to renew token using regular token in $_GET, cookie, or header
        $jwtAuth = $this->jwtAuth;
        $payload = $jwtAuth->getTokenPayload();
        if ($payload) {
            return ["success" => $this->generateAuthOutput($payload->user, $payload->rememberMe, $payload->jwtCookie)];
        }

        // attempt to renew token using refresh token
        return $this->actionUseRefreshToken();
    }

    /**
     * Get refresh token
     * Note: PERMANENT. You should have some way to revoke these access tokens
     */
    public function actionRequestRefreshToken()
    {
        /** @var \app\models\User $user */

        $jwtAuth = $this->jwtAuth;
        $payload = $jwtAuth->getTokenPayload();
        if (!$payload) {
            return ["error" => Yii::t("app", "Invalid token")];
        }

        // get user based off of id and get access token
        $user = Yii::$app->user->identityClass;
        $user = $user::findIdentity($payload->sub);

        // generate refresh token
        // note that we use $user->id here, but it can also be the id of your token table
        $id = $user->id;
        $token = $user->accessToken;
        return ["success" => $jwtAuth->generateRefreshToken($id, $token, $payload->jwtCookie)];
    }

    /**
     * Remove refresh token
     */
    public function actionRemoveRefreshToken()
    {
        $this->jwtAuth->removeRefreshCookieToken();
        return ["success" => true];
    }

    /**
     * Use refreshToken to refresh the regular token
     * @return array
     */
    public function actionUseRefreshToken()
    {
        /** @var \app\models\User $user */

        // get token/payload
        $jwtAuth = $this->jwtAuth;
        $payload = $jwtAuth->getRefreshTokenPayload();
        if (!$payload) {
            return ["error" => Yii::t("app", "Invalid token")];
        }

        // find user and generate auth data
        // note: we don't need rememberMe when using refresh tokens
        $rememberMe = false;
        $user = Yii::$app->user->identityClass;
        $user = $user::findIdentityByAccessToken($payload->accessToken);
        return ["success" => $this->generateAuthOutput($user->toArray(), $rememberMe, $payload->jwtCookie)];
    }

    /**
     * Generate auth data (for sending back to client)
     * @param array|object $userAttributes
     * @param bool $rememberMe
     * @param bool $jwtCookie
     * @return boolean
     */
    protected function generateAuthOutput($userAttributes, $rememberMe, $jwtCookie)
    {
        $jwtAuth = $this->jwtAuth;
        $token = $jwtAuth->generateUserToken($userAttributes, $rememberMe, $jwtCookie);
        return [
            "user" => $userAttributes,
            "token" => $token,
        ];
    }
}
