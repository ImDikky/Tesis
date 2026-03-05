// ==========================================================================
// PROYECTO SVIBVA - LÓGICA DE INTERFAZ DE USUARIO
// ==========================================================================

// 1. GESTIÓN DEL TEMA (CLARO/OSCURO)
const themeToggleBtn = document.getElementById('themeToggle');
const body = document.body;

themeToggleBtn.addEventListener('click', () => {
    // Verifica el atributo actual y lo alterna
    if (body.getAttribute('data-theme') === 'dark') {
        body.setAttribute('data-theme', 'light');
        themeToggleBtn.textContent = 'Cambiar a Modo Oscuro';
    } else {
        body.setAttribute('data-theme', 'dark');
        themeToggleBtn.textContent = 'Cambiar a Modo Claro';
    }
});

// 2. GESTIÓN DEL MODO ENFOQUE (FOCUS MODE)
function toggleFocus(element) {
    const grid = document.getElementById('cameraGrid');
    
    // Si la cámara clickeada ya está enfocada, vuelve a la vista de cuadrícula
    if (element.classList.contains('focused')) {
        element.classList.remove('focused');
        grid.classList.remove('focus-mode');
    } 
    // Si no está enfocada, oculta las demás y expande la seleccionada
    else {
        // Remueve la clase 'focused' de cualquier otra cámara
        document.querySelectorAll('.camera-card').forEach(card => {
            card.classList.remove('focused');
        });
        
        // Aplica el enfoque a la cámara actual
        element.classList.add('focused');
        grid.classList.add('focus-mode');
    }
}