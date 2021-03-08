const { default: SignedJWT } = require('jose/jwt/sign');
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
    "USER1_APP1_SPACE1_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qa_user1",
        "app_id": stackData.apps.app1.id,
        "space_id": stackData.apps.app1.spaces.space1.id,
        "app_secret": stackData.apps.app1.secret
    },
    "USER2_APP1_SPACE1_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qa_user1",
        "app_id": stackData.apps.app1.id,
        "space_id": stackData.apps.app1.spaces.space1.id,
        "app_secret": stackData.apps.app1.secret
    },
    "USER3_APP1_SPACE1_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qa_user1",
        "app_id": stackData.apps.app1.id,
        "space_id": stackData.apps.app1.spaces.space1.id,
        "app_secret": stackData.apps.app1.secret
    },
    "USER4_APP1_SPACE1_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qa_user1",
        "app_id": stackData.apps.app1.id,
        "space_id": stackData.apps.app1.spaces.space1.id,
        "app_secret": stackData.apps.app1.secret
    },
    "ADMIN_ID_APP2_SPACE1_SIGNED": {
        "admin": true,
        "signed": true,
        "user_id": "qateamAdmin",
        "app_id": stackData.apps.app2.id,
        "space_id": stackData.apps.app2.spaces.space1.id,
        "app_secret": stackData.apps.app2.secret
    },
    "NON_ADMIN_ID_APP2_SPACE1_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app2.id,
        "space_id": stackData.apps.app2.spaces.space1.id,
        "app_secret": stackData.apps.app2.secret
    },
    "NON_ADMIN_ID_APP2_SPACE1_UNSIGNED": {
        "admin": false,
        "signed": false,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app2.id,
        "space_id": stackData.apps.app2.spaces.space1.id,
        "app_secret": stackData.apps.app2.secret
    },
    "NON_ADMIN_APP2_SPACE_ID_NONEXISTANT_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app2.id,
        "space_id": stackData.apps.app2.spaces.nonexistant.id,
        "app_secret": stackData.apps.app2.secret
    },
    "NON_ADMIN_APP2_SPACE_NAME_NONEXISTANT_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app2.id,
        "space_name": stackData.apps.app2.spaces.nonexistant.name,
        "app_secret": stackData.apps.app2.secret
    },
    "NON_ADMIN_APP2_NO_SPACE_NAME_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app2.id,
        "app_secret": stackData.apps.app2.secret
    },
    "NON_ADMIN_APP2_SPACE1_TIMED_SIGNED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app2.id,
        "space_id": stackData.apps.app2.spaces.space1.id,
        "app_secret": stackData.apps.app2.secret,
        "expired": false
    },
    "NON_ADMIN_APP2_SPACE1_TIMED_EXPIRED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app2.id,
        "space_id": stackData.apps.app2.spaces.space1.id,
        "app_secret": stackData.apps.app2.secret,
        "expired": true
    },
    "NON_ADMIN_APP2_SPACE1_TIMED_PREISSUED": {
        "admin": false,
        "signed": true,
        "user_id": "qateamNonAdmin",
        "app_id": stackData.apps.app2.id,
        "space_id": stackData.apps.app2.spaces.space1.id,
        "app_secret": stackData.apps.app2.secret,
        "preissued": true
    }
};

export async function generateJWT(tokenType: { [property: string]: any }) {
    const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(tokenType.app_secret, "utf8"));
    try {
        let data: any = {};
        data = {
            "user_id": tokenType.user_id,
            "app_id": tokenType.app_id
        };
        if (tokenType.admin) data.admin = tokenType.admin;
        if (tokenType.space_id) data.space_id = tokenType.space_id;
        if (tokenType.space_name) data.space_name = tokenType.space_name;
        if (tokenType.signed) {
            return await new SignedJWT(data)
                .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
                .sign(SECRET_KEY_FOR_SIGNING);
        } else {
            return await new UnsecuredJWT(data).encode();
        }
    } catch (error) {
        console.error(`Couldn't create JWT! Error:\n${error}`);
        return;
    }
}