from pygdbmi.gdbcontroller import GdbController

class Gdb:
  def __init__(self):
    self.gdbmi = GdbController()

  def command(self, command):
    return self.gdbmi.write(command)

