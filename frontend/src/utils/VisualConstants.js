module.exports = {
  VariableCard: {
    SIZING: {
      HEIGHT: 50,
      TITLE_UPPER_RECT_HEIGHT: 20,
      TITLE_LOWER_RECT_HEIGHT: 10,
      TITLE_HEIGHT: 20,
      OUTLINE_WIDTH: 2,
      CORNER_RADIUS: 15
    },
    ALIGNMENT: {
      TITLE: "center",
      VALUE: "center"
    },
    FONT: {
      FAMILY: "Menlo, monospace",
      TITLE_SIZE: 15,
      BODY_SIZE: 25
    },
    COLORS: {
      BODY: "white",
      TYPES: {
        "bool": "rgb(227,156,255)",
        "char": "rgb(147, 255, 163)",
        "double": "rgb(210,255,139)",
        "int": "rgb(255,127,127)",
        "long int": "rgb(255, 213, 147)",
        "pointer": "rgb(165,209,255)",
        "string": "rgb(255,228,129)",
        DEFAULT: "rgb(147, 188, 255)"
      }
    }
  },
  StackFrameCard: {
    SIZING: {
      MIN_HEIGHT: 150,
      TITLE_HEIGHT: 30,
      OUTLINE_WIDTH: 2,
      CORNER_RADIUS: 15
    },
    ALIGNMENT: {
      TITLE: "center"
    },
    FONT: {
      FAMILY: "Menlo, monospace",
      TITLE_SIZE: 20
    },
    COLORS: {
      BODY: "white",
      ACTIVE: "rgb(94, 227, 100)",
      INACTIVE: "rgb(197, 204, 216)"
    }
  }
};
