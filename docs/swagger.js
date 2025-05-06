const swaggerJsdoc = require("swagger-jsdoc")
const path = require("path")

const options = {
    definition: {
      openapi: "3.0.3",
      info: {
        title: "Albaranes - Express API with Swagger",
        version: "0.1.0",
        description:
          "Backend for PWSE made with Express and documented with Swagger",
        license: {
          name: "MIT",
          url: "https://spdx.org/licenses/MIT.html",
        },
        contact: {
          name: "u-tad",
          url: "https://u-tad.com",
          email: "lucia.manso@live.u-tad.com",
        },
      },
      servers: [
        {
          url: "http://localhost:3000/api",
        },
      ],
      components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer"
            },
        },
        schemas:{
            UserInputRegister: {
              type: 'object',
              required: ['name','email','password'],
              properties: {
                name: { type: 'string', example: 'Menganito' },
                email: { type: 'string', example: 'user@example.com' },
                password: { type: 'string' }
              }
            },
            UserEmailValidation: {
              type: 'object',
              required: ['token'],
              properties: { token: { type: 'string', description: 'Validation token sent by email' } }
            },
            UserLogin: { $ref: '#/components/schemas/login' },
            UserPersonalData: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'integer' }
              }
            },
            UserCompanyData: {
              type: 'object',
              properties: {
                companyName: { type: 'string' },
                address: { type: 'string' }
              }
            },
            UserLogoUpload: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' }
              }
            },
            UserPasswordRecover: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', example: 'user@example.com' } }
            },
            UserPasswordReset: {
              type: 'object',
              required: ['token','newPassword'],
              properties: {
                token: { type: 'string' },
                newPassword: { type: 'string' }
              }
            },
            UserInvite: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', example: 'invitee@example.com' } }
            },
            ClientInput: {
              type: 'object',
              required: ['name','email'],
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' }
              }
            },
            ClientOutput: { $ref: '#/components/schemas/Client' },
            ProjectInput: {
              type: 'object',
              required: ['title','clientId'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                clientId: { type: 'string' }
              }
            },
            ProjectOutput: { $ref: '#/components/schemas/Project' },
            DeliveryNoteItem: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'integer' },
                price: { type: 'number' }
              }
            },
            DeliveryNoteInput: {
              type: 'object',
              required: ['user','client','items'],
              properties: {
                user: { type: 'string' },
                client: { type: 'string' },
                project: { type: 'string' },
                items: { type: 'array', items: { $ref: '#/components/schemas/DeliveryNoteItem' } }
              }
            },
            DeliveryNoteSignInput: {
              type: 'object',
              required: ['signature'],
              properties: { signature: { type: 'string', format: 'binary' } }
            },
            DeliveryNoteOutput: { $ref: '#/components/schemas/DeliveryNote' },
            ApiInfo: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                version: { type: 'string' },
                endpoints: {
                  type: 'object',
                  additionalProperties: { type: 'string' }
                }
              }
            },
            RootInfo: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                api: { type: 'string' }
              }
            },
            UserResponse: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '605c5d4f5311236168a109ca' },
                email: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                nif: { type: 'string' },
                isEmailVerified: { type: 'boolean' },
                role: { type: 'string' },
                company: { $ref: '#/components/schemas/UserCompanyData' },
                logo: { type: 'object', properties: { url: { type: 'string' }, filename: { type: 'string' } } },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },
            AuthResponse: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                user: { $ref: '#/components/schemas/UserResponse' }
              }
            },
            Client: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                company: { type: 'string' },
                createdBy: { type: 'string' },
                archived: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },
            Project: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                client: { type: 'string' },
                createdBy: { type: 'string' },
                archived: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },
            DeliveryNote: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                deliveryNoteNumber: { type: 'string' },
                project: { type: 'string' },
                client: { type: 'string' },
                createdBy: { type: 'string' },
                date: { type: 'string', format: 'date-time' },
                items: { type: 'array', items: { $ref: '#/components/schemas/DeliveryNoteItem' } },
                isSigned: { type: 'boolean' },
                signedAt: { type: 'string', format: 'date-time' },
                signatureUrl: { type: 'string' },
                pdfUrl: { type: 'string' },
                notes: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
        },
        responses: {
          ValidationError: { description: 'Validation Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          UnauthorizedError: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ForbiddenError: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          NotFoundError: { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ConflictError: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          InternalServerError: { description: 'Internal Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      },
    },
    apis: [ path.join(__dirname, '../routes/*.js') ],
  };

module.exports = swaggerJsdoc(options)
