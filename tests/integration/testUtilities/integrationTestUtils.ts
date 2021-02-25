const { default: SignJWT } = require('jose/jwt/sign');
const crypto = require('crypto');
const secrets = require('../secrets/auth.json');

export const TOKEN_GEN_DATA = {
    "USER_ID_ADMIN": "qateamAdmin",
    "USER_ID_NONADMIN": "qateamNonAdmin",
    "APP_ID1": secrets.staging.apps[0].id,
    "SECRET_APP1": secrets.staging.apps[0].secret,
    "SPACE1_ID_APP1": secrets.staging.apps[0].spaces[0].id,
    "SPACE1_NAME_APP1": secrets.staging.apps[0].spaces[0].name,
    "APP_ID2": secrets.staging.apps[1].id,
    "SECRET_APP2": secrets.staging.apps[1].secret,
    "SPACE1_ID_APP2": secrets.staging.apps[1].spaces[0].id,
    "SPACE1_NAME_APP2": secrets.staging.apps[1].spaces[0].name
};

export const TOKEN_GEN_TYPES = {
    "ADMIN_ID_APP1_SPACE1_SIGNED": [true, true, TOKEN_GEN_DATA.USER_ID_ADMIN, TOKEN_GEN_DATA.APP_ID1, TOKEN_GEN_DATA.SPACE1_ID_APP1, TOKEN_GEN_DATA.SECRET_APP1],
    "NONADMIN_ID_APP1_SPACE1_SIGNED": [false, true, TOKEN_GEN_DATA.USER_ID_ADMIN, TOKEN_GEN_DATA.APP_ID1, TOKEN_GEN_DATA.SPACE1_ID_APP1, TOKEN_GEN_DATA.SECRET_APP1],
    "NONADMINTOKEN_SPACEID_UNSIGNED": [false, false, TOKEN_GEN_DATA.USER_ID_ADMIN, TOKEN_GEN_DATA.APP_ID1, TOKEN_GEN_DATA.SPACE1_ID_APP1, TOKEN_GEN_DATA.SECRET_APP1],
};

export async function generateJWT(genParams:any[]) {
    let hiFiJWT;
    const SECRET_KEY_FOR_SIGNING = crypto.createSecretKey(Buffer.from(genParams[5], "utf8"));
    try {
        hiFiJWT = await new SignJWT({
            "admin": genParams[0],
            "signed": genParams[1],
            "user_id": genParams[2],
            "app_id": genParams[3],
            "space_id": genParams[4]
        })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .sign(SECRET_KEY_FOR_SIGNING);

        return hiFiJWT;
    } catch (error) {
        console.error(`Couldn't create JWT! Error:\n${error}`);
        return;
    }
}