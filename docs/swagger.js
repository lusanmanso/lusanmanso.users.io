// File: docs/swagger.js
const swaggerJsdoc = require("swagger-jsdoc")
const path = require("path")

const options = {
    definition: {
      openapi: "3.0.3",
      info: {
        title: "Albaranes - Express API with Swagger",
        version: "1.0.0",
        description: "Backend completo para gestión de albaranes con Express y documentado con Swagger",
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
          description: "Servidor de desarrollo"
        },
        {
          url: "https://inclined-bonnibelle-bildyapp-1fff10be.koyeb.app/api",
          description: "Servidor de producción"
        }
      ],
      components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT"
            },
        },
        schemas: {
            //
            UserInputRegister: {
              type: 'object',
              required: ['email', 'password', 'passwordConfirm'],
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'user@example.com',
                  description: 'Email único del usuario'
                },
                password: {
                  type: 'string',
                  minLength: 8,
                  example: 'Password123!',
                  description: 'Contraseña de al menos 8 caracteres'
                },
                passwordConfirm: {
                  type: 'string',
                  example: 'Password123!',
                  description: 'Confirmación de contraseña'
                }
              }
            },

            UserLogin: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'user@example.com'
                },
                password: {
                  type: 'string',
                  example: 'Password123!'
                }
              }
            },

            UserEmailValidation: {
              type: 'object',
              required: ['token'],
              properties: {
                token: {
                  type: 'string',
                  description: 'Token de validación enviado por email'
                }
              }
            },

            UserPersonalData: {
              type: 'object',
              properties: {
                firstName: { type: 'string', example: 'Juan' },
                lastName: { type: 'string', example: 'Pérez' },
                nif: { type: 'string', example: '12345678Z' },
                phone: { type: 'string', example: '+34666123456' }
              }
            },

            UserCompanyData: {
              type: 'object',
              properties: {
                company: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'Mi Empresa SL' },
                    cif: { type: 'string', example: 'B12345678' },
                    address: {
                      type: 'object',
                      properties: {
                        street: { type: 'string', example: 'Calle Principal 123' },
                        city: { type: 'string', example: 'Madrid' },
                        postalCode: { type: 'string', example: '28001' },
                        country: { type: 'string', example: 'España', default: 'Spain' }
                      }
                    },
                    isAutonomous: { type: 'boolean', default: false }
                  }
                }
              }
            },

            UserResponse: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '605c5d4f5311236168a109ca' },
                email: { type: 'string', format: 'email' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                nif: { type: 'string' },
                phone: { type: 'string' },
                isEmailVerified: { type: 'boolean' },
                role: {
                  type: 'string',
                  enum: ['user', 'admin', 'guest'],
                  default: 'user'
                },
                company: { $ref: '#/components/schemas/UserCompanyData' },
                logo: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' },
                    filename: { type: 'string' }
                  }
                },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },

            AuthResponse: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'JWT token para autenticación'
                },
                user: { $ref: '#/components/schemas/UserResponse' },
                message: { type: 'string' }
              }
            },

            ClientInput: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: {
                  type: 'string',
                  example: 'Juan Pérez',
                  description: 'Nombre completo del cliente'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'cliente@empresa.com'
                },
                company: {
                  type: 'string',
                  nullable: true,
                  description: 'ID de la empresa (opcional)'
                }
              }
            },

            ClientOutput: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                company: { type: 'string', nullable: true },
                createdBy: { type: 'string', description: 'ID del usuario que creó el cliente' },
                archived: { type: 'boolean', default: false },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },

            ProjectInput: {
              type: 'object',
              required: ['name', 'client'],
              properties: {
                name: {
                  type: 'string',
                  maxLength: 150,
                  example: 'Desarrollo Web Corporativo'
                },
                description: {
                  type: 'string',
                  maxLength: 500,
                  nullable: true,
                  example: 'Desarrollo completo de la página web corporativa'
                },
                client: {
                  type: 'string',
                  description: 'ID del cliente asociado',
                  example: '605c5d4f5311236168a109ca'
                }
              }
            },

            ProjectOutput: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                client: {
                  oneOf: [
                    { type: 'string' },
                    { $ref: '#/components/schemas/ClientOutput' }
                  ],
                  description: 'Puede ser ID o objeto cliente completo'
                },
                createdBy: { type: 'string' },
                archived: { type: 'boolean', default: false },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },

            DeliveryNoteItem: {
              type: 'object',
              required: ['description', 'quantity'],
              properties: {
                description: {
                  type: 'string',
                  example: 'Desarrollo Frontend - React',
                  description: 'Descripción del trabajo o material'
                },
                quantity: {
                  type: 'number',
                  minimum: 0.01,
                  example: 8,
                  description: 'Cantidad o horas trabajadas'
                },
                unitPrice: {
                  type: 'number',
                  minimum: 0,
                  default: 0,
                  example: 65.00,
                  description: 'Precio unitario (opcional)'
                },
                person: {
                  type: 'string',
                  nullable: true,
                  example: 'Juan Desarrollador',
                  description: 'Persona que realizó el trabajo (opcional)'
                }
              }
            },

            DeliveryNoteInput: {
              type: 'object',
              required: ['deliveryNoteNumber', 'projectId', 'items'],
              properties: {
                deliveryNoteNumber: {
                  type: 'string',
                  example: 'ALB-2025-001',
                  description: 'Número único del albarán'
                },
                projectId: {
                  type: 'string',
                  example: '605c5d4f5311236168a109ca',
                  description: 'ID del proyecto asociado'
                },
                date: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Fecha del albarán (por defecto: fecha actual)'
                },
                items: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DeliveryNoteItem' },
                  minItems: 1,
                  description: 'Lista de elementos del albarán'
                },
                notes: {
                  type: 'string',
                  nullable: true,
                  example: 'Notas adicionales del albarán'
                }
              }
            },

            DeliveryNoteOutput: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                deliveryNoteNumber: { type: 'string' },
                project: {
                  oneOf: [
                    { type: 'string' },
                    { $ref: '#/components/schemas/ProjectOutput' }
                  ]
                },
                client: {
                  oneOf: [
                    { type: 'string' },
                    { $ref: '#/components/schemas/ClientOutput' }
                  ]
                },
                createdBy: { type: 'string' },
                date: { type: 'string', format: 'date-time' },
                items: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DeliveryNoteItem' }
                },
                totalAmount: {
                  type: 'number',
                  description: 'Importe total calculado automáticamente'
                },
                status: {
                  type: 'string',
                  enum: ['draft', 'sent', 'signed'],
                  default: 'draft'
                },
                isSigned: { type: 'boolean', default: false },
                signedDate: { type: 'string', format: 'date-time', nullable: true },
                signerName: { type: 'string', nullable: true },
                signerTitle: { type: 'string', nullable: true },
                signatureUrl: { type: 'string', nullable: true },
                pdfUrl: { type: 'string', nullable: true },
                notes: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            },

            ApiInfo: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Albaranes API' },
                version: { type: 'string', example: '1.0.0' },
                endpoints: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                  example: {
                    users: '/api/user',
                    clients: '/api/client',
                    projects: '/api/project',
                    deliveryNotes: '/api/deliverynote'
                  }
                }
              }
            },

            RootInfo: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Welcome to Albaranes API' },
                api: { type: 'string', example: '/api' }
              }
            },

            Error: {
              type: 'object',
              required: ['message'],
              properties: {
                message: {
                  type: 'string',
                  example: 'Error description'
                },
                errors: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Lista detallada de errores de validación'
                },
                code: {
                  type: 'string',
                  description: 'Código específico del error'
                }
              }
            },

            ValidationError: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Validation failed' },
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
        },

        responses: {
          ValidationError: {
            description: 'Error de validación',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          },
          UnauthorizedError: {
            description: 'No autorizado - Token inválido o faltante',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { message: 'Access denied. No token provided.' }
              }
            }
          },
          ForbiddenError: {
            description: 'Prohibido - No tienes permisos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          NotFoundError: {
            description: 'Recurso no encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { message: 'Resource not found' }
              }
            }
          },
          ConflictError: {
            description: 'Conflicto - Recurso ya existe',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          InternalServerError: {
            description: 'Error interno del servidor',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },

      // Etiquetas para agrupar endpoints
      tags: [
        {
          name: 'General',
          description: 'Endpoints generales de información de la API'
        },
        {
          name: 'User',
          description: 'Gestión de usuarios, autenticación y perfil'
        },
        {
          name: 'Client',
          description: 'Gestión de clientes'
        },
        {
          name: 'Project',
          description: 'Gestión de proyectos'
        },
        {
          name: 'DeliveryNote',
          description: 'Gestión de albaranes'
        }
      ]
    },

    apis: [
      path.join(__dirname, '../routes/*.js'),
      path.join(__dirname, '../controllers/*.js') // Incluir controladores si tienen doc
    ],
  };

module.exports = swaggerJsdoc(options)
