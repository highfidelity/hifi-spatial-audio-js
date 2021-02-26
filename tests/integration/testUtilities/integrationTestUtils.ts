const { default: SignJWT } = require('jose/jwt/sign');
const { default: UnsecuredJWT } = require('jose/jwt/unsecured');
const crypto = require('crypto');
const stackData = require('../secrets/auth.json').stackData;

export const TOKEN_GEN_TYPES = {
    "ADMIN_ID_APP1_SPACE1_SIGNED": {
        "admin": true,
        "signed": true,
        "user_id": "qateamAdmin",
        "app_id": stackData.apps.app1.id,
        "space_id": stackData.apps.app1.spaces.space1.id,
        "app_secret": stackData.apps.app1.secret
    },
    "NON_ADMIN_ID_APP1_SPACE1_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app1.id,
        "space_id": stackData.apps.app1.spaces.space1.id,
        "app_secret": stackData.apps.app1.secret
    },
    "NON_ADMIN_APP1_SPACE1_ID_UNSIGNED": {
        "admin": false,
        "signed": false,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app1.id,
        "space_id": stackData.apps.app1.spaces.space1.id,
        "app_secret": stackData.apps.app1.secret
    },
    "NON_ADMIN_ID_APP1_SPACE_NONEXISTANT_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app1.id,
        "space_id": stackData.apps.app1.spaces.nonexistant,
        "app_secret": stackData.apps.app1.secret
    }
};

export async function generateSignedJWT(tokenType: { [property: string]: any }) {
    const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(tokenType.app_secret, "utf8"));
    try {
        if (tokenType.signed) {
            return await new SignJWT({
                "admin": tokenType.admin,
                "user_id": tokenType.user_id,
                "app_id": tokenType.app_id,
                "space_id": tokenType.space_id
            })
                .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
                .sign(SECRET_KEY_FOR_SIGNING);
        } else {
            return await new UnsecuredJWT({
                "admin": tokenType.admin,
                "user_id": tokenType.user_id,
                "app_id": tokenType.app_id,
                "space_id": tokenType.space_id
            }).encode();
        }
    } catch (error) {
        console.error(`Couldn't create JWT! Error:\n${error}`);
        return;
    }
}