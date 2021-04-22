const { default: SignedJWT } = require('jose/jwt/sign');
const { default: UnsecuredJWT } = require('jose/jwt/unsecured');
const crypto = require('crypto');

export let tokenTypes: any = {};

let stackData: { apps: { APP_1: { id: string; secret: string; }; APP_2: { id: string; secret: string; }; }; };
export function setStackData(stack: { apps: { APP_1: { id: string; secret: string; }; APP_2: { id: string; secret: string; }; }; }) {
    stackData = stack;

    tokenTypes = {
        "ADMIN_ID_APP1": {
            "admin": true,
            "signed": true,
            "user_id": "qateamAdmin",
            "app_id": stackData.apps.APP_1.id,
            "app_secret": stackData.apps.APP_1.secret
        },
        "NONADMIN_ID_APP1": {
            "admin": false,
            "signed": true,
            "user_id": "qateamNonAdmin",
            "app_id": stackData.apps.APP_1.id,
            "app_secret": stackData.apps.APP_1.secret
        },
        "ADMIN_ID_APP2": {
            "admin": true,
            "signed": true,
            "user_id": "qateamAdmin",
            "app_id": stackData.apps.APP_2.id,
            "app_secret": stackData.apps.APP_2.secret
        },
        "NONADMIN_ID_APP2": {
            "admin": false,
            "signed": true,
            "user_id": "qateamNonAdmin",
            "app_id": stackData.apps.APP_2.id,
            "app_secret": stackData.apps.APP_2.secret
        },
        "NONADMIN_ID_APP2_UNSIGNED": {
            "admin": false,
            "signed": false,
            "user_id": "qateamNonAdmin",
            "app_id": stackData.apps.APP_2.id,
            "app_secret": stackData.apps.APP_2.secret
        },
        "NONADMIN_APP2_TIMED": {
            "admin": false,
            "signed": true,
            "user_id": "qateamNonAdmin",
            "app_id": stackData.apps.APP_2.id,
            "app_secret": stackData.apps.APP_2.secret,
            "expired": false
        },
        "NONADMIN_APP2_TIMED_EXPIRED": {
            "admin": false,
            "signed": true,
            "user_id": "qateamNonAdmin",
            "app_id": stackData.apps.APP_2.id,
            "app_secret": stackData.apps.APP_2.secret,
            "expired": true
        },
        "NONADMIN_APP2_DUP": {
            "admin": false,
            "signed": true,
            "user_id": "qateamNonAdmin",
            "app_id": stackData.apps.APP_2.id,
            "app_secret": stackData.apps.APP_2.secret
        }
    };
}

export async function generateJWT(tokenType: { [property: string]: any }, spaceID?: string, spaceName?: string) {
    const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(tokenType.app_secret, "utf8"));
    try {
        let data: any = {};
        let token: string;
        data = {
            "user_id": tokenType.user_id,
            "app_id": tokenType.app_id
        };
        if (tokenType.admin) data.admin = tokenType.admin;
        if (spaceID) data.space_id = spaceID;
        if (spaceName) data.space_name = spaceName;
        if (tokenType.space_name) data.space_name = tokenType.space_name;
        if (tokenType.signed) {
            if (tokenType.expired === true) {
                token = await new SignedJWT(data)
                    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
                    .setIssuedAt()
                    .setExpirationTime(Math.round(Date.now() / 1000) - 60 * 60)
                    .sign(SECRET_KEY_FOR_SIGNING);
            } else if (tokenType.expired === false) {
                token = await new SignedJWT(data)
                    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
                    .setExpirationTime(Math.round(Date.now() / 1000) + 60 * 60)
                    .sign(SECRET_KEY_FOR_SIGNING);
            } else {
                token = await new SignedJWT(data)
                    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
                    .sign(SECRET_KEY_FOR_SIGNING);
            }
        } else {
            token = await new UnsecuredJWT(data).encode();
        }
        return token;
    } catch (error) {
        console.error(`Couldn't create JWT! Error:\n${error}`);
        return;
    }
}

export function generateUUID() {
    let i = 0;
    let generatedUUID = "";
    let baseString = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

    while (i++ < 38) {
        let c = baseString[i - 1], r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        generatedUUID += (c == '-' || c == '4') ? c : v.toString(16)
    }

    return generatedUUID;
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export type ZoneData = {
    "x-min": number,
    "x-max": number,
    "y-min": number,
    "y-max": number,
    "z-min": number,
    "z-max": number,
    "name": string,
    "id"?: number
};

export type AttenuationData = {
    "attenuation": number,
    "listener-zone-id": number,
    "source-zone-id": number,
    "za-offset": number,
    "id"?: number
};
