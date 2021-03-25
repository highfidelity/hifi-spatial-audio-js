gpg --quiet --batch --yes --decrypt --passphrase="$TESTING_AUTH_DECRYPTION_KEY" \
--output tests/secrets/auth.json tests/secrets/auth.json.gpg