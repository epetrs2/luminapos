# LuminaPOS - Sistema de Punto de Venta

Sistema de punto de venta moderno con gestión de inventario, caja chica, reportes inteligentes y sincronización en la nube.

## 🚀 Pasos para Iniciar (Baby Steps)

Sigue estos pasos si acabas de descargar el proyecto:

### 1. Instalar Herramientas
Necesitas tener **Node.js** instalado en tu computadora. Si no lo tienes, descárgalo de [nodejs.org](https://nodejs.org/) e instálalo.

### 2. Preparar el Proyecto
Abre una terminal (consola) en la carpeta de este proyecto y ejecuta:

```bash
npm install
```
*(Esto descargará todas las piezas necesarias para que funcione)*

### 3. Configurar la Llave (Vital para la IA)
1.  En esta carpeta, crea un archivo nuevo llamado `.env`.
2.  Abre el archivo y pega lo siguiente (reemplazando con tu clave real):

```env
API_KEY=tu_clave_api_de_google_aqui
```
> Puedes obtener tu clave gratis en [Google AI Studio](https://aistudio.google.com/).

### 4. ¡Arrancar!
En la misma terminal, ejecuta:

```bash
npm run dev
```

Abre tu navegador en el link que aparece (usualmente `http://localhost:5173`) y usa las credenciales por defecto:
- **Usuario:** `admin`
- **Contraseña:** `Admin@123456`

---

## ☁️ Sincronización en la Nube (Opcional)

Si deseas sincronizar tus datos con Google Sheets:
1.  Ve a `backend/GoogleAppsScript.js` y copia el código.
2.  Crea un nuevo proyecto en [Google Apps Script](https://script.google.com/).
3.  Pega el código y configura la variable `API_SECRET`.
4.  Implementa como "Aplicación web" con acceso para "Cualquier persona".
5.  Copia la URL generada y pégala en la configuración de LuminaPOS (icono de engranaje en el Login o Dashboard).
