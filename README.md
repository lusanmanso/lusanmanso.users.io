# Práctica Intermedia 2025 - API de Gestión de Usuarios

Este proyecto implementa una API RESTful para la gestión de usuarios utilizando Node.js y Express. La API proporciona funcionalidades completas para registro, autenticación, validación y gestión de información de usuarios.

## Tecnologías utilizadas

- Node.js
- Express.js
- JWT (JSON Web Tokens)
- MongoDB/PostgreSQL (base de datos)
- Middlewares de validación
- Cifrado de contraseñas
- Manejo de archivos para logos

## Endpoints implementados

### 1. Registro de usuario
**Endpoint:** `POST /api/user/register`

**Especificaciones:**
- Validación de email.
- Validación de contraseña (mínimo 8 caracteres).
- Control de duplicidad de emails (error 409 si ya existe).
- Cifrado de contraseña.
- Generación de código de verificación de 6 dígitos.
- Respuesta con datos de usuario y token JWT.

### 2. Validación de email
**Endpoint:** `PUT /api/user/validation`

**Especificaciones:**
- Requiere token JWT.
- Validación del código de 6 dígitos.
- Actualización del estado a validado si el código es correcto.
- Error 4XX si el código es incorrecto.

### 3. Login
**Endpoint:** `POST /api/user/login`

**Especificaciones:**
- Validación de credenciales (email y contraseña).
- Respuesta con datos de usuario y token JWT si las credenciales son correctas.
- Error 4XX si las credenciales son incorrectas.

### 4. On boarding - Datos personales
**Endpoint:** `PUT /api/user/register`

**Especificaciones:**
- Requiere token JWT.
- Validación de datos personales (nombre, apellidos, NIF).
- Actualización de usuario con los datos proporcionados.

### 5. On boarding - Datos de compañía
**Endpoint:** `PATCH /api/user/company`

**Especificaciones:**
- Requiere token JWT.
- Validación de datos de compañía (nombre, CIF, dirección, etc.).
- Para usuarios autónomos, los datos de compañía son los datos personales.

### 6. Logo
**Endpoint:** `PATCH /api/user/logo`

**Especificaciones:**
- Recepción y control de tamaño de imagen.
- Almacenamiento en disco o nube (IPFS).
- Guardado de URL en base de datos.

### 7. Endpoints adicionales

#### 7.1 Obtener usuario
**Endpoint:** `GET /api/user`

**Especificaciones:**
- Requiere token JWT.
- Obtiene los datos del usuario a partir del token.

#### 7.2 Eliminar usuario
**Endpoint:** `DELETE /api/user`

**Especificaciones:**
- Requiere token JWT.
- Eliminación hard o soft según parámetro `?soft=false`.

#### 7.3 Recuperación de contraseña
**Endpoint:** `POST /api/user/recover-password`

**Especificaciones:**
- Solicita email.
- Envía código de recuperación.
- Permite establecer nueva contraseña con código válido.

#### 7.4 Invitación a compañeros
**Endpoint:** `POST /api/user/invite`

**Especificaciones:**
- Requiere token JWT.
- Permite invitar a otros usuarios para unirse a la compañía con rol de invitado.

## Estructura del proyecto

```
/src
  /controllers
    userController.js
  /middlewares
    auth.js
    validation.js
  /models
    userModel.js
  /routes
    userRoutes.js
  /services
    userService.js
  /utils
    passwordUtils.js
    jwtUtils.js
  app.js
  server.js
```

## Instalación y configuración

1. Clonar el repositorio
```bash
git clone https://github.com/usuario/proyecto.git
cd proyecto
```

2. Instalar dependencias
```bash
npm install
```

3. Crear archivo .env con las siguientes variables
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/api-usuarios
JWT_SECRET=your_jwt_secret
```

4. Iniciar el servidor
```bash
npm start
```

## Documentación de la API

La documentación completa de la API está disponible en Swagger:
[https://inclined-bonnibelle-bildyapp-1fff10be.koyeb.app/api-docs/](https://inclined-bonnibelle-bildyapp-1fff10be.koyeb.app/api-docs/)

## Notas de implementación

- Todas las rutas de la API comienzan con `/api/user/`.
- Se debe implementar el manejo adecuado de errores y validaciones.
- Las contraseñas deben ser almacenadas de forma segura utilizando algoritmos de hash como bcrypt.
- El token JWT debe ser incluido en las cabeceras de autorización para las rutas protegidas.