# Anuncios de Meta desde la terminal

CLI para crear y operar los anuncios de GoyCaz Labs en Facebook e Instagram,
con el clic yendo directo a WhatsApp. Sin dependencias: solo Node 18+.

El objetivo del embudo es el del negocio: **que el dueño de la clinica escriba
al WhatsApp y agende el diagnostico de 10 minutos.** Todo lo que crea este CLI
nace pausado, porque aca se gasta plata real.

---

## Antes de tocar la terminal

Esto se hace una sola vez, en el navegador. Son ~30 minutos.

### 1. Portafolio comercial

En [business.facebook.com](https://business.facebook.com) crea un portafolio
para **GoyCaz Labs** (aparte del de Tia Vane: cada negocio con el suyo, asi los
limites de la API y los permisos no se pisan).

Dentro del portafolio, en *Configuracion del negocio*, agrega:

- La **pagina de Facebook** de GoyCaz Labs.
- La **cuenta de Instagram** `@goycaz.labs`, vinculada a esa pagina.
- Una **cuenta publicitaria** nueva, moneda **USD**, zona horaria
  **America/Lima**. La moneda y la zona no se pueden cambiar despues.
- Un **metodo de pago** en la cuenta publicitaria. Sin esto la API deja crear
  campanas pero nunca las publica.

### 2. Pagina de privacidad en el sitio

Meta exige una URL de politica de privacidad publica para activar la app. El
sitio todavia no la tiene — hay que publicar `goycazlabs.com/privacidad` antes
del paso 3.

### 3. App de desarrollador

En [developers.facebook.com/apps](https://developers.facebook.com/apps):

1. *Crear app* → tipo **Empresa** → nombre `goycaz-ads`.
2. Vinculala al portafolio de GoyCaz Labs.
3. Agrega el producto **Marketing API**.
4. En *Configuracion → Basica*: dominio `goycazlabs.com` y la URL de privacidad
   del paso 2. Anota el **ID de la app** y la **clave secreta**.

### 4. Usuario del sistema y token

El token del Explorador de la Graph API caduca en una o dos horas. El del
usuario del sistema no caduca, y es el que hay que usar.

En *Configuracion del negocio → Usuarios → Usuarios del sistema*:

1. *Agregar* → nombre `goycaz-ads-cli` → rol **Administrador**.
2. *Agregar activos*: la cuenta publicitaria (control total), la pagina
   (control total) y la cuenta de Instagram.
3. *Generar nuevo token* → elige la app `goycaz-ads` → **sin fecha de
   caducidad** → marca estos permisos:

   | Permiso | Para que |
   |---|---|
   | `ads_management` | crear y editar campanas |
   | `ads_read` | leer resultados |
   | `business_management` | ver los activos del portafolio |
   | `pages_show_list` | listar la pagina |
   | `pages_read_engagement` | leer la pagina |
   | `pages_manage_ads` | publicar anuncios en nombre de la pagina |
   | `instagram_basic` | mostrar el anuncio en Instagram |

4. Copia el token **en ese momento**: Meta no lo vuelve a mostrar.

> Para anunciar tu propio negocio no necesitas revision de la app. El acceso
> estandar de `ads_management` alcanza para las cuentas donde tu usuario del
> sistema es administrador.

---

## Configuracion local

```bash
cd ops/meta-ads
cp .env.example .env
```

Pega el token en `META_ACCESS_TOKEN` y comprueba que todo responde:

```bash
npm run ads doctor      # token, version de API, estado de la cuenta
npm run ads discover    # descubre tus IDs y te imprime el bloque del .env
```

`discover` imprime las lineas ya armadas: pegalas en `.env` y vuelve a correr
`doctor`. Cuando termine en "Todo listo para lanzar", esta listo.

`.env` esta en `.gitignore`. El token da acceso a gastar dinero: nunca al repo,
nunca a un chat.

---

## Uso diario

```bash
npm run ads geo Lima                  # claves de ubicacion para segmentar
npm run ads intereses odontologia     # intereses disponibles

# Crea campana + conjunto + anuncio, todo PAUSADO
npm run ads lanzar -- --presupuesto 10 --imagen ./creativo.jpg

npm run ads listar                    # que hay y en que estado
npm run ads activar <id-campana>      # recien aca empieza a gastar
npm run ads metricas -- --rango last_7d
npm run ads pausar <id-campana>
```

Opciones de `lanzar`: `--nombre`, `--presupuesto` (por dia, en la moneda de la
cuenta), `--titular`, `--texto`, `--descripcion`, `--imagen`, `--geo`.

El default sale del posicionamiento del negocio: Lima, 25 a 64 anos, Facebook e
Instagram, optimizado a conversaciones de WhatsApp.

---

## Lo que el CLI no hace a proposito

- **No activa nada.** `lanzar` deja todo pausado; activar es una decision tuya
  con el Administrador de anuncios abierto.
- **No sube el presupuesto solo.** Cada cambio de gasto es un comando explicito.
- **No inventa creativos.** La imagen la pasas tu con `--imagen`.
