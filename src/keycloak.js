const session = require('express-session');
const Keycloak = require('keycloak-connect');

let keycloak;

function initKeycloak(app) {
    if (keycloak) {
        return keycloak;
    }

    const memoryStore = new session.MemoryStore();

    app.use(session({
        secret: process.env.SESSION_SECRET || 'some-secret-key-for-session',
        resave: false,
        saveUninitialized: true,
        store: memoryStore
    }));

    // Configure Keycloak with Bearer Only mode
    const keycloakConfig = {
        "realm": process.env.KEYCLOAK_REALM || 'ecommerce',
        "auth-server-url": process.env.KEYCLOAK_URL || 'http://keycloak:8080/auth',
        "resource": process.env.KEYCLOAK_CLIENT_ID || 'payment-service',
        "bearer-only": true,
        "confidential-port": 0
    };

    if (process.env.KEYCLOAK_CLIENT_SECRET) {
      keycloakConfig.credentials = {
        secret: process.env.KEYCLOAK_CLIENT_SECRET
      };
    }

    keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

    app.use(keycloak.middleware({
        logout: '/logout',
        admin: '/'
    }));

    return keycloak;
}

function getKeycloak() {
    if (!keycloak) {
        throw new Error('Keycloak has not been initialized. Please call initKeycloak first.');
    }
    return keycloak;
}

module.exports = {
    initKeycloak,
    getKeycloak
};
