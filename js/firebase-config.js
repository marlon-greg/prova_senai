// Configuração do Firebase — projeto prova-senai-3e983
export const firebaseConfig = {
  apiKey: "AIzaSyAiX1kSv6igSa2JZ0ku3_Ebt0jEt15x7kk",
  authDomain: "prova-senai-3e983.firebaseapp.com",
  projectId: "prova-senai-3e983",
  storageBucket: "prova-senai-3e983.firebasestorage.app",
  messagingSenderId: "256758244039",
  appId: "1:256758244039:web:0f52ed191c174cda2814e2"
};

// E-mail do administrador principal (tem que ser o MESMO que está em firestore.rules)
export const SUPER_ADMIN = "marlon.frodrigues@docente.senai.br";

// Domínios de e-mail aceitos para alunos
export const DOMINIOS_ALUNOS_PADRAO = ["edu.senai.br", "aluno.senai.br"];

// true = usa o Firebase Emulator local. Em produção deixe false.
export const USAR_EMULADOR = false;