/**
 * Environment variable validation utility
 * Ensures all required environment variables are present and valid
 */

const { logger } = require('./logger');

class EnvValidationError extends Error {
    constructor(message, missing = [], invalid = []) {
        super(message);
        this.name = 'EnvValidationError';
        this.missing = missing;
        this.invalid = invalid;
    }
}

const validators = {
    required: (value) => value !== undefined && value !== '',
    
    string: (value) => typeof value === 'string' && value.length > 0,
    
    number: (value) => !isNaN(Number(value)),
    
    boolean: (value) => ['true', 'false', '1', '0'].includes(String(value).toLowerCase()),
    
    url: (value) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },
    
    snowflake: (value) => /^\d{17,19}$/.test(value),
    
    oneOf: (allowedValues) => (value) => allowedValues.includes(value)
};

class EnvValidator {
    constructor() {
        this.schema = {};
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Define a required environment variable
     * @param {string} name - Variable name
     * @param {Object} options - Validation options
     */
    require(name, options = {}) {
        this.schema[name] = {
            required: true,
            type: options.type || 'string',
            default: options.default,
            validate: options.validate,
            description: options.description
        };
        return this;
    }

    /**
     * Define an optional environment variable
     * @param {string} name - Variable name
     * @param {Object} options - Validation options
     */
    optional(name, options = {}) {
        this.schema[name] = {
            required: false,
            type: options.type || 'string',
            default: options.default,
            validate: options.validate,
            description: options.description
        };
        return this;
    }

    /**
     * Validate all defined environment variables
     * @throws {EnvValidationError} If validation fails
     */
    validate() {
        const missing = [];
        const invalid = [];

        for (const [name, config] of Object.entries(this.schema)) {
            const value = process.env[name];

            // Check if required variable is missing
            if (config.required && !validators.required(value)) {
                missing.push(name);
                continue;
            }

            // Skip validation for optional missing variables
            if (!config.required && !value) {
                if (config.default !== undefined) {
                    process.env[name] = String(config.default);
                }
                continue;
            }

            // Type validation
            if (config.type && validators[config.type]) {
                if (!validators[config.type](value)) {
                    invalid.push({
                        name,
                        value,
                        expected: config.type,
                        description: config.description
                    });
                }
            }

            // Custom validation
            if (config.validate && typeof config.validate === 'function') {
                if (!config.validate(value)) {
                    invalid.push({
                        name,
                        value,
                        expected: 'custom validation',
                        description: config.description
                    });
                }
            }
        }

        if (missing.length > 0 || invalid.length > 0) {
            const errorMessages = [];

            if (missing.length > 0) {
                errorMessages.push(`Missing required variables: ${missing.join(', ')}`);
            }

            if (invalid.length > 0) {
                const invalidDesc = invalid.map(i => 
                    `${i.name} (expected: ${i.expected}, got: ${i.value})`
                ).join(', ');
                errorMessages.push(`Invalid variables: ${invalidDesc}`);
            }

            throw new EnvValidationError(
                `Environment validation failed:\n${errorMessages.join('\n')}`,
                missing,
                invalid
            );
        }

        logger.info('Environment variables validated successfully');
        return true;
    }

    /**
     * Get a validated and typed environment variable
     * @param {string} name - Variable name
     * @param {*} defaultValue - Default value if not set
     */
    get(name, defaultValue) {
        const value = process.env[name];
        const config = this.schema[name];

        if (!value) {
            return defaultValue !== undefined ? defaultValue : config?.default;
        }

        // Type conversion
        if (config?.type === 'number') {
            return Number(value);
        }

        if (config?.type === 'boolean') {
            return ['true', '1'].includes(String(value).toLowerCase());
        }

        return value;
    }
}

// Pre-configured validator for Puro bot
function createPuroValidator() {
    const validator = new EnvValidator();

    // Required Discord credentials
    validator
        .require('TOKEN', {
            type: 'string',
            description: 'Discord bot token'
        })
        .require('clientId', {
            type: 'snowflake',
            description: 'Discord application/client ID'
        });

    // Optional configuration
    validator
        .optional('LOG_LEVEL', {
            type: 'string',
            default: 'INFO',
            validate: validators.oneOf(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'])
        })
        .optional('LOG_COLORS', {
            type: 'boolean',
            default: 'true'
        })
        .optional('LOG_ICONS', {
            type: 'boolean',
            default: 'true'
        })
        .optional('LOG_TIMESTAMPS', {
            type: 'boolean',
            default: 'true'
        })
        .optional('NODE_ENV', {
            type: 'string',
            default: 'development',
            validate: validators.oneOf(['development', 'production', 'test'])
        });

    return validator;
}

module.exports = {
    EnvValidator,
    EnvValidationError,
    validators,
    createPuroValidator
};
