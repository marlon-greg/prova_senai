// Fundos do cartão do perfil: fotos reais do Wikimedia Commons (imagens em destaque/qualidade), com licença livre.
// Os alunos só ESCOLHEM entre estas (não há envio de imagem). Arquivos em img/fundos/<id>.jpg; o crédito aparece no cartão.
export const FUNDOS_PERFIL = [
  { id: "montanhas", nome: "Montanhas", autor: "Vyacheslav Argenberg", licenca: "CC BY 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Mountains_in_snow,_Mountain_lake,_Chola_Valley,_Nepal,_Himalayas.jpg" },
  { id: "praia", nome: "Praia", autor: "Vyacheslav Argenberg", licenca: "CC BY 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Havelock_Island,_Mangrove_tree_on_the_beach,_Andaman_Islands.jpg" },
  { id: "floresta", nome: "Floresta", autor: "Dietmar Rabich", licenca: "CC BY-SA 4.0", fonte: "https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Umland_--_2014_--_7056.jpg" },
  { id: "aurora", nome: "Aurora boreal", autor: "United States Air Force photo by Senior Airman Joshua Strang", licenca: "Public domain", fonte: "https://commons.wikimedia.org/wiki/File:Aurora_borealis_over_Eielson_Air_Force_Base,_Alaska.jpg" },
  { id: "cachoeira", nome: "Cachoeira", autor: "Wilfredor", licenca: "CC BY-SA 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Montmorency_waterfall,_Qu%C3%A9bec,_Qu%C3%A9bec.jpg" },
  { id: "dunas", nome: "Dunas", autor: "Brocken Inaglory", licenca: "CC BY-SA 3.0", fonte: "https://commons.wikimedia.org/wiki/File:Mesquite_Sand_Dunes_in_Death_Valley.jpg" },
  { id: "via-lactea", nome: "Céu estrelado", autor: "NOIRLab/NSF/AURA/ P. Horálek (Institute of Physics in Opava), T. Slovinský", licenca: "CC BY 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Night_Sky_from_Hawai%E2%80%98i_and_Chile_(iotw2225c).jpg" },
  { id: "terra", nome: "Terra vista do espaço", autor: "NASA", licenca: "Public domain", fonte: "https://commons.wikimedia.org/wiki/File:ISS-38_Hawaiian_Island_chain.jpg" },
  { id: "foguete", nome: "Lançamento de foguete", autor: "SpaceX", licenca: "CC0", fonte: "https://commons.wikimedia.org/wiki/File:CRS-9_mission_(28348649546).jpg" },
  { id: "eolicas", nome: "Energia eólica", autor: "Denkrahm", licenca: "CC BY 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Afsluitdijk_-_wind_turbines.jpg" },
  { id: "cidade", nome: "Cidade à noite", autor: "Wilfredor", licenca: "CC BY-SA 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Qu%C3%A9bec_city_at_night,_view_from_L%C3%A9vis_city.jpg" },
  { id: "biblioteca", nome: "Biblioteca", autor: "Matthew Petroff", licenca: "CC BY-SA 3.0", fonte: "https://commons.wikimedia.org/wiki/File:George-peabody-library.jpg" },
  { id: "datacenter", nome: "Data center", autor: "Florian Hirzinger – www.fh-ap.com", licenca: "CC BY-SA 3.0", fonte: "https://commons.wikimedia.org/wiki/File:CERN_Server.jpg" },
  { id: "robotica", nome: "Robótica industrial", autor: "KUKA Roboter GmbH, Bachmann", licenca: "Public domain", fonte: "https://commons.wikimedia.org/wiki/File:Factory_Automation_Robotics_Palettizing_Bread.jpg" },
  { id: "circuito", nome: "Placa de circuito", autor: "Jonathan Cutrer from San Angelo, Texas, United States", licenca: "CC BY 2.0", fonte: "https://commons.wikimedia.org/wiki/File:Circuit_board_Closeup_(24884297897).jpg" },
  { id: "laboratorio", nome: "Laboratório", autor: "Tadeáš Bednarz", licenca: "CC BY-SA 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Scanning_electron_microscope_-_UFCH_JH_(2020)_01.jpg" },
  { id: "telescopio", nome: "Radiotelescópios", autor: "brewbooks from near Seattle, USA", licenca: "CC BY-SA 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Allen_Telescope_Array_-_brewbooks.jpg" },
  { id: "teclado", nome: "Teclado", autor: "Colin", licenca: "CC BY-SA 4.0", fonte: "https://commons.wikimedia.org/wiki/File:Backlit_keyboard.jpg" }
];
export const fundoPerfil = id => FUNDOS_PERFIL.find(f => f.id === id) || null;
export const urlFundo = id => `img/fundos/${id}.jpg`;
export const urlMini = id => `img/fundos/mini/${id}.jpg`;
