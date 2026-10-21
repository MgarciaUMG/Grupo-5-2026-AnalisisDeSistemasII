package com.banco.auth.util;

import com.banco.auth.modelo.Rol;
import com.banco.auth.modelo.RolNombre;
import com.banco.auth.modelo.Usuario;
import com.banco.auth.repositorio.RolRepositorio;
import com.banco.auth.repositorio.UsuarioRepositorio;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private RolRepositorio rolRepositorio;

    @Autowired
    private UsuarioRepositorio usuarioRepositorio;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // 1. Insertar roles si no existen
        if (rolRepositorio.count() == 0) {
            rolRepositorio.save(new Rol(RolNombre.ROLE_USUARIO_FINAL, "Cliente que interpone la queja"));
            rolRepositorio.save(new Rol(RolNombre.ROLE_AGENTE_BANCARIO, "Agente que revisa y propone solución"));
            rolRepositorio.save(new Rol(RolNombre.ROLE_SUPERVISOR, "Supervisor que aprueba la propuesta"));
            rolRepositorio.save(new Rol(RolNombre.ROLE_JEFE, "Jefe que respalda al Supervisor"));
            rolRepositorio.save(new Rol(RolNombre.ROLE_ADMIN, "Administrador del sistema"));
            rolRepositorio.save(new Rol(RolNombre.ROLE_GERENTE, "Emite el dictamen final"));
        }

        // --- CREACIÓN DEL USUARIO ADMINISTRADOR ---
        if (!usuarioRepositorio.existsByEmail("elgarciam4@gmail.com")) {
            Usuario admin = new Usuario();
            admin.setNombre("Admin");
            admin.setApellido("Sistema");
            admin.setEmail("elgarciam4@gmail.com");
            admin.setPassword(passwordEncoder.encode("Admin123$")); 
            Rol rolAdmin = rolRepositorio.findByNombre(RolNombre.ROLE_ADMIN).get();
            admin.getRoles().add(rolAdmin);
            usuarioRepositorio.save(admin);
            System.out.println("Usuario Admin creado.");
        }

        // --- CREACIÓN DE AGENTES BANCARIOS ---
        crearUsuarioSiNoExiste("Samuel", "Patzan", "patzanj45@gmail.com", "Agente123$", RolNombre.ROLE_AGENTE_BANCARIO);
        crearUsuarioSiNoExiste("Luis", "Pérez", "agente2@banco.com", "Agente123$", RolNombre.ROLE_AGENTE_BANCARIO);
        crearUsuarioSiNoExiste("Carlos", "López", "agente3@banco.com", "Agente123$", RolNombre.ROLE_AGENTE_BANCARIO);

        // --- CREACIÓN DE SUPERVISOR Y JEFE ---
        crearUsuarioSiNoExiste("Marta", "Ruiz", "supervisor1@banco.com", "Super123$", RolNombre.ROLE_SUPERVISOR);
        crearUsuarioSiNoExiste("Jorge", "Díaz", "jefe1@banco.com", "Jefe123$", RolNombre.ROLE_JEFE);

        // --- CREACIÓN DE USUARIOS FINALES ---
        crearUsuarioSiNoExiste("Sofia", "Perez", "astridsofiaperez29896@gmail.com", "Cliente123$", RolNombre.ROLE_USUARIO_FINAL);
        crearUsuarioSiNoExiste("Pedro", "Sánchez", "cliente2@banco.com", "Cliente123$", RolNombre.ROLE_USUARIO_FINAL);

        crearUsuarioSiNoExiste("Eddy", "Ramirez", "gerente1@banco.com", "Gerente123$", RolNombre.ROLE_GERENTE);
    }

    // Método auxiliar para no repetir tanto código
    private void crearUsuarioSiNoExiste(String nombre, String apellido, String email, String password, RolNombre rolNombre) {
        if (!usuarioRepositorio.existsByEmail(email)) {
            Usuario usuario = new Usuario();
            usuario.setNombre(nombre);
            usuario.setApellido(apellido);
            usuario.setEmail(email);
            usuario.setPassword(passwordEncoder.encode(password));
            usuario.setActivo(true); // Asumiendo que tu entidad Usuario tiene el campo activo, si no lo tiene configurado por defecto
            
            Rol rol = rolRepositorio.findByNombre(rolNombre).get();
            usuario.getRoles().add(rol);
            
            usuarioRepositorio.save(usuario);
            System.out.println("Usuario creado: " + email + " | Rol: " + rolNombre);
        }
    }
}