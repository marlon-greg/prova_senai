// =====================================================================
//  COLE AQUI o objeto firebaseConfig do seu projeto
//  (Firebase Console > Configurações do projeto > Seus apps > Web > Config)
// =====================================================================
export const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "SEU-PROJETO.firebaseapp.com",
  projectId: "SEU-PROJETO",
  storageBucket: "SEU-PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

// E-mail do administrador principal (tem que ser o MESMO que está em firestore.rules)
export const SUPER_ADMIN = "marlon.frodrigues@docente.senai.br";

// Domínios de e-mail aceitos para alunos (também salvos em config/geral; aqui é só o padrão inicial)
export const DOMINIOS_ALUNOS_PADRAO = ["edu.senai.br", "aluno.senai.br"];

// true = usa o Firebase Emulator local (só para testes no seu computador). Em produção deixe false.
export const USAR_EMULADOR = false;
