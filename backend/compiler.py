import os
import re
import sys
from subprocess import Popen, PIPE

class Compiler:
  def __init__(self, lang):
    self.lang = lang
    self.__setup_c() if lang == 'c' else self.__setup_cpp()

  def __setup_c(self):
    self.cc = 'gcc'
    self.dialect = '-std=c11'

  def __setup_cpp(self):
    self.cc = 'g++'
    self.dialect = '-std=c++11'

  def compile(self, filename):
    return None

