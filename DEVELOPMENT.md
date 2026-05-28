# 📖 Guía de Desarrollo

## 🚀 Inicio Rápido

```bash
npm install         # Instalar dependencias
npm run dev         # Iniciar servidor de desarrollo
npm run build       # Compilar para producción
```

---

## ✅ ANTES DE HACER GIT PUSH

**⚠️ IMPORTANTE:** Siempre valida localmente ANTES de pushear a GitHub.

### Paso 1: Validación Manual
```bash
npm run validate
```

Este comando:
- ✓ Instala dependencias
- ✓ Compila el proyecto (`npm run build`)
- ✓ Ejecuta linting (`npm run lint`)

Si ves ✅ **"VALIDACIÓN COMPLETADA"**, estás listo para pushear.

### Paso 2: Git Commit y Push
```bash
git add .
git commit -m "feat: tu descripción aquí"
git push origin main
```

**El hook `pre-push` automáticamente:**
- 🔨 Compila el proyecto
- ❌ **Si falla** → Bloquea el push (corrije el error localmente)
- ✅ **Si pasa** → Permite el push

---

## 🐛 Si hay errores de build

### Ver logs detallados:
```bash
npm run debug-build
```

Esto genera un archivo de log en `build-logs/` con toda la salida del build.

### Errores comunes:

#### ❌ "npm: command not found"
```bash
# Asegúrate que npm está instalado
node --version
npm --version

# Si no está, instala Node.js desde nodejs.org
```

#### ❌ "Cannot find module..."
```bash
# Limpia node_modules y reinstala
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### ❌ "TypeScript errors"
```bash
# Verifica que no haya errores de tipo
npm run build 2>&1 | grep -i "error"

# Algunas advertencias son OK, pero los errores deben corregirse
```

---

## 🔄 Flujo Completo (Recomendado)

1. **Haz cambios en el código**
   ```bash
   vim src/app/page.tsx
   ```

2. **Prueba localmente**
   ```bash
   npm run dev
   # Abre http://localhost:3000
   # Verifica que funcione
   ```

3. **Valida antes de commit**
   ```bash
   npm run validate
   # Espera a ver "✅ VALIDACIÓN COMPLETADA"
   ```

4. **Haz commit**
   ```bash
   git add .
   git commit -m "fix: descripción corta"
   ```

5. **El hook `pre-push` automáticamente valida**
   ```bash
   git push origin main
   # Si hay error → corrígelo y intenta de nuevo
   # Si pasa → ¡Estás listo!
   ```

6. **GitHub Actions valida automáticamente**
   - Ve a GitHub → Tu PR
   - Espera a que Actions finalice (✓ o ❌)
   - Si ✓ → Puedes mergear
   - Si ❌ → Arregla el error y haz push de nuevo

7. **Vercel deploya automáticamente**
   - Una vez que mergeas a `main`
   - Vercel recibe el webhook
   - Compila y deploya a producción
   - Ver: https://vercel.com/dashboard

---

## 📊 Status de CI/CD

Para ver el estado de los checks:
- **En local:** `npm run validate`
- **En GitHub:** Click en el PR → "Checks" tab
- **En Vercel:** https://vercel.com/dashboard → Tu proyecto

---

## 🆘 Necesito Ayuda

Si el validador no te deja pushear pero crees que tu código está correcto:

1. **Revisa los logs:**
   ```bash
   npm run debug-build
   cat build-logs/latest.log
   ```

2. **Verifica que sea un error real:**
   - ¿Es un error de TypeScript?
   - ¿Es un módulo faltante?
   - ¿Es una ruta incorrecta?

3. **Arreglalo y valida de nuevo:**
   ```bash
   npm run validate
   ```

4. **Si aún no funciona:**
   - Limpia todo:
     ```bash
     rm -rf node_modules .next package-lock.json
     npm install
     npm run validate
     ```

---

## 📝 Notas Importantes

- ✅ El validador está aquí para **ayudarte**, no para molestarte
- ✅ Es mejor atrapar errores en tu máquina que en producción
- ✅ Los hooks automáticos previenen cambios rotos
- ⏱️ El build toma ~5-10 segundos (espera pacientemente)

---

## 📚 Recursos

- [Next.js Docs](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [GitHub Actions](https://docs.github.com/en/actions)
