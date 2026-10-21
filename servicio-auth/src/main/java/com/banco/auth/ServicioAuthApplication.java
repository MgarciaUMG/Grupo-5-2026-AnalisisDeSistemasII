package com.banco.auth;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class ServicioAuthApplication {

    // Este método se ejecuta automáticamente justo al iniciar el servicio
    @PostConstruct
    public void init() {
        // Forzar la zona horaria a UTC-6 (Guatemala)
        TimeZone.setDefault(TimeZone.getTimeZone("America/Guatemala"));
        System.out.println("Zona horaria configurada a: " + TimeZone.getDefault().getID());
    }

    public static void main(String[] args) {
        SpringApplication.run(ServicioAuthApplication.class, args);
    }

}
