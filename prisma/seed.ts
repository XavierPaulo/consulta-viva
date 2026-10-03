import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const OFFSET = "-03:00";
const day = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
};
const at = (offsetDays: number, time: string) => new Date(`${day(offsetDays)}T${time}:00${OFFSET}`);

async function main() {
  // limpa tudo (ordem por dependência)
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.medicalRecord.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.message.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.professional.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.specialty.deleteMany(),
    prisma.insurance.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.testimonial.deleteMany(),
    prisma.faqItem.deleteMany(),
    prisma.clinic.deleteMany(),
  ]);

  await prisma.clinic.create({
    data: {
      name: "Clínica Viva Saúde",
      tagline: "Cuidado próximo, do agendamento ao retorno.",
      about:
        "Somos uma clínica multiespecialidades com atendimento humanizado, presencial e por teleconsulta. Agende em poucos cliques, escolha o profissional e receba a confirmação na hora.",
      cnpj: "12.345.678/0001-90",
      phone: "(11) 3456-7890",
      whatsapp: "(11) 98765-4321",
      email: "contato@vivasaude.com.br",
      address: "Av. Paulista, 1000 – Bela Vista, São Paulo – SP",
      primaryColor: "#0f766e",
      openingHours: "Segunda a sexta, das 8h às 19h\nSábado, das 8h às 12h",
      paymentMethods: JSON.stringify(["PARTICULAR", "CONVENIO", "CREDITO", "DEBITO", "PIX", "PARCELAMENTO"]),
      maxInstallments: 3,
      instagram: "https://instagram.com/vivasaude",
      privacyPolicy:
        "Esta Política de Privacidade descreve como a Clínica Viva Saúde coleta, usa e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).\n\nDados coletados: nome, CPF, telefone, e-mail, data de nascimento e informações de saúde necessárias ao atendimento.\n\nFinalidade: agendamento, prestação do atendimento médico, emissão de documentos e cobrança.\n\nDados de saúde são dados sensíveis e só são tratados com seu consentimento explícito ou para tutela da saúde. O prontuário é mantido por no mínimo 20 anos, conforme o Conselho Federal de Medicina.\n\nSeus direitos: acesso, correção, portabilidade, anonimização e eliminação dos dados não obrigatórios. Para exercê-los, fale com nosso encarregado pelo e-mail contato@vivasaude.com.br.",
      termsOfUse:
        "Ao usar este site você concorda com estes Termos de Uso. O agendamento online está sujeito à disponibilidade e às regras de cancelamento informadas no momento da marcação. Teleconsultas seguem a Resolução CFM nº 2.314/2022.",
      cancellationPolicy:
        "Cancelamentos e remarcações podem ser feitos pelo link da confirmação até 24 horas antes da consulta. Após esse prazo, fale com a recepção.",
      hiddenSections: "[]",
    },
  });

  const [paulista, moema] = await Promise.all([
    prisma.unit.create({ data: { name: "Unidade Paulista", address: "Av. Paulista, 1000 – Bela Vista" } }),
    prisma.unit.create({ data: { name: "Unidade Moema", address: "Av. Ibirapuera, 2500 – Moema" } }),
  ]);

  const specs = await Promise.all(
    [
      ["Clínica Geral", "stethoscope", "Atendimento integral para adultos, check-ups e encaminhamentos.", "febre, cansaço, check-up, gripe, mal-estar, exames de rotina"],
      ["Cardiologia", "heart", "Prevenção, diagnóstico e tratamento de doenças do coração.", "dor no peito, pressão alta, falta de ar, palpitação, arritmia"],
      ["Dermatologia", "sparkles", "Cuidados com pele, cabelos e unhas.", "acne, manchas, queda de cabelo, coceira, alergia de pele, pintas"],
      ["Pediatria", "baby", "Acompanhamento da saúde de bebês, crianças e adolescentes.", "criança, bebê, vacina, febre infantil, crescimento"],
      ["Ginecologia", "flower", "Saúde da mulher em todas as fases da vida.", "menstruação, preventivo, gravidez, menopausa, cólica"],
      ["Ortopedia", "bone", "Ossos, músculos e articulações.", "dor nas costas, joelho, coluna, torção, fratura, dor no ombro"],
      ["Psiquiatria", "brain", "Saúde mental com acolhimento e sigilo.", "ansiedade, depressão, insônia, estresse, pânico"],
      ["Endocrinologia", "activity", "Hormônios, metabolismo e diabetes.", "diabetes, tireoide, obesidade, emagrecimento, colesterol"],
    ].map(([name, icon, description, symptoms]) =>
      prisma.specialty.create({
        data: {
          name: name!,
          icon: icon!,
          description: description!,
          symptoms: symptoms!,
          slug: name!.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "-"),
        },
      }),
    ),
  );
  const sp = Object.fromEntries(specs.map((s) => [s.name, s.id]));

  const ins = await Promise.all(
    ["Unimed", "Bradesco Saúde", "SulAmérica", "Amil"].map((name) => prisma.insurance.create({ data: { name } })),
  );

  const weekdays = (from: number, to: number, start: string, end: string, unitId?: string) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ weekday: from + i, startTime: start, endTime: end, unitId }));

  const pros = [
    {
      name: "Ana Beatriz Moreira",
      title: "Dra.",
      crm: "123456",
      specialties: ["Clínica Geral", "Endocrinologia"],
      bio: "Atendo adultos com foco em prevenção e acompanhamento de doenças crônicas, explicando cada passo do tratamento com calma.",
      education: "Medicina – USP (2010)\nResidência em Clínica Médica – Hospital das Clínicas\nTítulo de especialista em Endocrinologia – SBEM",
      experience: "14 anos de experiência em consultório e hospital. Ex-preceptora de residência em Clínica Médica.",
      priceCents: 30000,
      durationMin: 30,
      telemedicine: true,
      unitId: paulista.id,
      availability: [...weekdays(1, 5, "08:00", "12:00"), ...weekdays(1, 3, "14:00", "18:00")],
      insurances: [0, 1, 2],
    },
    {
      name: "Carlos Eduardo Lima",
      title: "Dr.",
      crm: "234567",
      specialties: ["Cardiologia"],
      bio: "Cardiologista com atuação em prevenção cardiovascular, hipertensão e avaliação pré-operatória.",
      education: "Medicina – UNIFESP (2008)\nResidência em Cardiologia – InCor",
      experience: "16 anos de experiência. Membro da Sociedade Brasileira de Cardiologia.",
      priceCents: 40000,
      durationMin: 40,
      telemedicine: true,
      unitId: paulista.id,
      availability: [...weekdays(2, 4, "13:00", "19:00")],
      insurances: [0, 3],
    },
    {
      name: "Juliana Costa Ferreira",
      title: "Dra.",
      crm: "345678",
      specialties: ["Dermatologia"],
      bio: "Dermatologia clínica e estética com abordagem individualizada para cada tipo de pele.",
      education: "Medicina – Unicamp (2012)\nResidência em Dermatologia – Santa Casa de SP",
      experience: "12 anos de experiência. Membro da Sociedade Brasileira de Dermatologia.",
      priceCents: 35000,
      durationMin: 30,
      telemedicine: false,
      unitId: moema.id,
      availability: [...weekdays(1, 5, "09:00", "13:00", moema.id), { weekday: 6, startTime: "08:00", endTime: "12:00", unitId: moema.id }],
      insurances: [1, 2],
    },
    {
      name: "Rafael Nogueira Santos",
      title: "Dr.",
      crm: "456789",
      specialties: ["Pediatria"],
      bio: "Pediatra apaixonado por acompanhar o crescimento das crianças junto com as famílias.",
      education: "Medicina – Santa Casa (2014)\nResidência em Pediatria – Instituto da Criança HC-FMUSP",
      experience: "10 anos de experiência em pediatria geral e puericultura.",
      priceCents: 28000,
      durationMin: 30,
      telemedicine: true,
      unitId: moema.id,
      availability: [...weekdays(1, 5, "14:00", "18:00", moema.id)],
      insurances: [0, 1, 2, 3],
    },
    {
      name: "Marina Alves Pacheco",
      title: "Dra.",
      crm: "567890",
      specialties: ["Psiquiatria"],
      bio: "Psiquiatra com foco em ansiedade, depressão e distúrbios do sono. Atendimento acolhedor e sem julgamentos.",
      education: "Medicina – UFMG (2011)\nResidência em Psiquiatria – IPq HC-FMUSP",
      experience: "13 anos de experiência clínica, presencial e por teleconsulta.",
      priceCents: 45000,
      durationMin: 50,
      telemedicine: true,
      unitId: paulista.id,
      availability: [...weekdays(1, 4, "09:00", "17:00")],
      insurances: [],
    },
  ];

  const created = [];
  for (const p of pros) {
    const slug = p.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "-");
    created.push(
      await prisma.professional.create({
        data: {
          name: p.name,
          title: p.title,
          slug,
          crm: p.crm,
          crmUf: "SP",
          bio: p.bio,
          education: p.education,
          experience: p.experience,
          priceCents: p.priceCents,
          durationMin: p.durationMin,
          telemedicine: p.telemedicine,
          unitId: p.unitId,
          specialties: { connect: p.specialties.map((s) => ({ id: sp[s] })) },
          insurances: { connect: p.insurances.map((i) => ({ id: ins[i]!.id })) },
          availability: { create: p.availability },
        },
      }),
    );
  }

  const patients = await Promise.all(
    [
      ["Fernanda Souza", "52998224725", "11991234567", "fernanda@email.com", "1988-04-12", "F"],
      ["João Pedro Almeida", "11144477735", "11992345678", "joao.almeida@email.com", "1975-09-30", "M"],
      ["Luciana Ribeiro", "39053344705", "11993456789", "luciana.r@email.com", "1992-01-22", "F"],
      ["Marcos Vinícius Rocha", "86288366757", "11994567890", "marcos.rocha@email.com", "1969-07-03", "M"],
      ["Helena Martins (criança)", "71428793860", "11995678901", "pais.helena@email.com", "2019-11-15", "F"],
      ["Roberto Dias", "45317828791", "11996789012", "roberto.dias@email.com", "1958-02-08", "M"],
    ].map(([name, cpf, phone, email, birth, sex]) =>
      prisma.patient.create({
        data: { name: name!, cpf, phone: phone!, email: email!, birthDate: new Date(`${birth}T12:00:00${OFFSET}`), sex: sex!, lgpdConsentAt: new Date() },
      }),
    ),
  );

  const [ana, carlos, juliana, rafael, marina] = created;
  type A = [typeof ana, number, number, string, string, string?, string?];
  const appts: A[] = [
    [ana!, 0, -10, "09:00", "REALIZADA"],
    [carlos!, 1, -7, "14:00", "REALIZADA", undefined, ins[0]!.id],
    [juliana!, 2, -5, "10:00", "FALTOU"],
    [ana!, 3, -3, "08:30", "REALIZADA"],
    [marina!, 0, -2, "10:00", "REALIZADA", "TELECONSULTA"],
    [rafael!, 4, -1, "15:00", "REALIZADA", undefined, ins[1]!.id],
    [ana!, 5, 0, "09:00", "CONFIRMADA"],
    [ana!, 1, 0, "10:30", "AGENDADA"],
    [carlos!, 3, 1, "15:20", "AGENDADA"],
    [juliana!, 2, 1, "11:00", "CONFIRMADA"],
    [marina!, 0, 2, "11:40", "AGENDADA", "TELECONSULTA"],
    [rafael!, 4, 3, "14:30", "AGENDADA"],
    [ana!, 3, 4, "08:00", "CANCELADA"],
  ];
  const now = Date.now();
  for (const [pro, pi, d, time, status, type, insuranceId] of appts) {
    const start = at(d, time);
    // pula domingos: empurra para segunda
    if (start.getUTCDay() === 0) start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start.getTime() + pro!.durationMin * 60_000);
    const appt = await prisma.appointment.create({
      data: {
        professionalId: pro!.id,
        patientId: patients[pi]!.id,
        unitId: pro!.unitId,
        start,
        end,
        status,
        type: type ?? "PRESENCIAL",
        insuranceId: insuranceId ?? null,
        priceCents: insuranceId ? 0 : pro!.priceCents,
        source: pi % 2 ? "ONLINE" : "INTERNO",
        cancelReason: status === "CANCELADA" ? "Paciente pediu para remarcar" : "",
      },
    });
    if (status === "REALIZADA") {
      await prisma.payment.create({
        data: {
          patientId: patients[pi]!.id,
          appointmentId: appt.id,
          description: `Consulta – ${pro!.title} ${pro!.name}`,
          amountCents: insuranceId ? 15000 : pro!.priceCents,
          method: insuranceId ? "CONVENIO" : ["PIX", "CREDITO", "DEBITO"][pi % 3]!,
          status: insuranceId ? "PENDENTE" : "PAGO",
          paidAt: insuranceId ? null : start,
        },
      });
      await prisma.medicalRecord.create({
        data: {
          patientId: patients[pi]!.id,
          professionalId: pro!.id,
          appointmentId: appt.id,
          createdById: "seed",
          createdAt: end,
          subjective: "Paciente relata cansaço há duas semanas, sem febre. Nega dor torácica.",
          objective: "PA 120x80 mmHg, FC 72 bpm, afebril. Ausculta sem alterações.",
          assessment: "Fadiga a esclarecer. Suspeita de anemia leve.",
          plan: "Solicitar hemograma completo e ferritina. Retorno em 30 dias com exames.",
          prescriptions: {
            create: [{ medication: "Sulfato ferroso 40 mg", dosage: "1 comprimido ao dia", instructions: "Tomar 30 min antes do almoço por 60 dias." }],
          },
        },
      });
    } else if (start.getTime() > now && status !== "CANCELADA" && !insuranceId) {
      await prisma.payment.create({
        data: {
          patientId: patients[pi]!.id,
          appointmentId: appt.id,
          description: `Consulta – ${pro!.title} ${pro!.name}`,
          amountCents: pro!.priceCents,
          method: "LINK",
          status: "PENDENTE",
          linkToken: `demo${pi}${d}`,
          gateway: "simulado",
          dueDate: start,
        },
      });
    }
  }

  await prisma.message.createMany({
    data: [
      {
        name: "Patrícia Gomes",
        email: "patricia.g@email.com",
        whatsapp: "11988887777",
        preferredChannel: "WHATSAPP",
        body: "Olá! A Dra. Ana atende pelo convênio Unimed para consulta de tireoide?",
        professionalId: ana!.id,
      },
      {
        name: "Eduardo Lopes",
        email: "edu.lopes@email.com",
        preferredChannel: "EMAIL",
        body: "Preciso de um laudo de risco cirúrgico. Qual o prazo para entrega após a consulta?",
        professionalId: carlos!.id,
        status: "LIDA",
      },
    ],
  });

  await prisma.testimonial.createMany({
    data: [
      { author: "Fernanda S.", text: "Agendei pelo celular em dois minutos e fui atendida no horário. Equipe muito atenciosa!", rating: 5, authorized: true },
      { author: "João P.", text: "O Dr. Carlos explicou tudo com muita paciência. Recomendo demais.", rating: 5, authorized: true },
      { author: "Luciana R.", text: "Ambiente acolhedor e a teleconsulta funcionou perfeitamente.", rating: 4, authorized: true },
      { author: "Paciente anônimo", text: "Depoimento ainda sem autorização (não aparece no site).", rating: 5, authorized: false },
    ],
  });

  await prisma.faqItem.createMany({
    data: [
      { order: 1, question: "Como faço para agendar uma consulta?", answer: "Clique em “Agendar consulta”, escolha a especialidade ou o profissional, selecione o horário e confirme seus dados. Você recebe a confirmação por e-mail e WhatsApp." },
      { order: 2, question: "Posso cancelar ou remarcar?", answer: "Sim. Use o link enviado na confirmação até 24 horas antes da consulta." },
      { order: 3, question: "Vocês atendem por teleconsulta?", answer: "Sim, para as especialidades indicadas com o selo “Teleconsulta”. O link seguro é enviado antes do horário." },
      { order: 4, question: "Quais convênios são aceitos?", answer: "Unimed, Bradesco Saúde, SulAmérica e Amil. Cada profissional informa no perfil os convênios que atende." },
    ],
  });

  const hash = await bcrypt.hash("Viva@2026", 10);
  await prisma.user.createMany({
    data: [
      { email: "admin@vivasaude.com.br", name: "Paulo (Administrador)", role: "ADMIN", passwordHash: hash },
      { email: "ana@vivasaude.com.br", name: "Dra. Ana Beatriz Moreira", role: "MEDICO", passwordHash: hash, professionalId: ana!.id },
      { email: "recepcao@vivasaude.com.br", name: "Camila (Recepção)", role: "SECRETARIA", passwordHash: hash },
      { email: "auditor@vivasaude.com.br", name: "Auditor (Leitura)", role: "LEITURA", passwordHash: hash },
    ],
  });

  console.log("Seed concluído. Senha de todos os usuários de demonstração: Viva@2026");
}

main().finally(() => prisma.$disconnect());
