g6t-salary

## HTMLDocs

- Run `npm install` to make sure `htmldocs`, `@htmldocs/react` y `@htmldocs/render` estén disponibles.
- Ejecuta el visor con `npm run docs:dev`; abre el navegador en la URL que muestre la consola (por defecto http://localhost:3000) para ver los cambios en caliente.
- Las plantillas viven en `documents/` (ejemplo: `documents/MonthlySummary.tsx`). Exporta el componente React como `default` y, si quieres previsualización con datos, añade `Component.PreviewProps`.
- Ajusta estilos directamente con CSS/inline styles o importa tus hojas de estilo desde el componente.
- Cuando necesites publicar un PDF en la nube, inicia sesión con `npx htmldocs@latest login` y luego ejecuta `npx htmldocs@latest publish documents/NombreDelDocumento.tsx`.
